/**
 * plugins/withSmsReceiver.js
 *
 * Expo Config Plugin — restores the native Android SMS BroadcastReceiver
 * after every `expo prebuild` wipe.
 *
 * Does three things:
 *   1. Writes SmsModule.kt, SmsPackage.kt, SmsReceiver.kt into the generated
 *      android/app/src/main/java/com/nexoraai/app/ directory.
 *   2. Patches MainApplication.kt to call add(SmsPackage()) in getPackages().
 *   3. Registers <receiver android:name=".SmsReceiver"> in AndroidManifest.xml.
 */

const { withDangerousMod, withAndroidManifest } = require('@expo/config-plugins');
const fs   = require('fs');
const path = require('path');

// ─── Kotlin source files ──────────────────────────────────────────────────────

const SMS_MODULE_KT = `package com.nexoraai.app

import android.Manifest
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class SmsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        // Weak reference via a nullable instance so BroadcastReceiver can emit events
        // without preventing GC of the module if React Native reloads.
        @Volatile
        private var instance: SmsModule? = null

        /**
         * Called by SmsReceiver on every incoming SMS.
         * Emits "onSmsReceived" { sender, body } to JavaScript.
         */
        fun emitSmsReceived(sender: String, body: String) {
            val module = instance ?: return
            try {
                val params = Arguments.createMap().apply {
                    putString("sender", sender)
                    putString("body", body)
                }
                module.reactApplicationContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("onSmsReceived", params)
            } catch (e: Exception) {
                // React context may not be ready; silently ignore
            }
        }
    }

    init {
        instance = this
    }

    override fun getName(): String = "SmsModule"

    // ── Permission check ────────────────────────────────────────────────────────
    /**
     * Resolves true if both READ_SMS and RECEIVE_SMS are currently granted.
     * Runtime permission prompts should be handled from JavaScript via
     * PermissionsAndroid.request() for best UX — this method is a fast check.
     */
    @ReactMethod
    fun requestSmsPermission(promise: Promise) {
        val ctx = reactApplicationContext
        val read    = ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_SMS)
        val receive = ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECEIVE_SMS)
        promise.resolve(
            read    == PackageManager.PERMISSION_GRANTED &&
            receive == PackageManager.PERMISSION_GRANTED
        )
    }

    // ── Inbox reader ─────────────────────────────────────────────────────────────
    /**
     * Queries content://sms/inbox and returns the 50 most recent messages as a
     * ReadableArray of { id, sender, body, date } maps.
     */
    @ReactMethod
    fun getSmsInbox(promise: Promise) {
        try {
            val resolver = reactApplicationContext.contentResolver
            val uri      = Uri.parse("content://sms/inbox")
            val columns  = arrayOf("_id", "address", "body", "date")

            val cursor: Cursor? = resolver.query(
                uri,
                columns,
                null,
                null,
                "date DESC"
            )

            val result = Arguments.createArray()
            var count  = 0

            cursor?.use { c ->
                val colId     = c.getColumnIndexOrThrow("_id")
                val colAddr   = c.getColumnIndexOrThrow("address")
                val colBody   = c.getColumnIndexOrThrow("body")
                val colDate   = c.getColumnIndexOrThrow("date")

                while (c.moveToNext() && count < 50) {
                    val map = Arguments.createMap()
                    map.putString("id",     c.getString(colId)   ?: "")
                    map.putString("sender", c.getString(colAddr) ?: "Unknown")
                    map.putString("body",   c.getString(colBody) ?: "")
                    map.putDouble("date",   c.getLong(colDate).toDouble())
                    result.pushMap(map)
                    count++
                }
            }

            promise.resolve(result)
        } catch (e: SecurityException) {
            promise.reject("PERMISSION_DENIED", "READ_SMS permission not granted")
        } catch (e: Exception) {
            promise.reject("SMS_ERROR", e.message ?: "Failed to read SMS inbox")
        }
    }

    // ── Required stubs for RN event emitter (both architectures) ────────────────
    @ReactMethod
    fun addListener(eventName: String) { /* no-op — events are emitted reactively */ }

    @ReactMethod
    fun removeListeners(count: Int) { /* no-op */ }
}
`;

const SMS_PACKAGE_KT = `package com.nexoraai.app

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class SmsPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(SmsModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
`;

const SMS_RECEIVER_KT = `package com.nexoraai.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

class SmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isNullOrEmpty()) return

        // getOriginatingAddress() from first segment; all parts share same sender
        val sender = messages[0].originatingAddress ?: "Unknown"

        // Concatenate multi-part message bodies in order
        val body = messages.joinToString("") { it.messageBody ?: "" }

        if (body.isBlank()) return

        SmsModule.emitSmsReceived(sender, body)
    }
}
`;

// ─── Step 1: Write Kotlin source files ───────────────────────────────────────

const withSmsKotlinFiles = (config) =>
  withDangerousMod(config, [
    'android',
    (config) => {
      const packageDir = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/java/com/nexoraai/app'
      );
      fs.mkdirSync(packageDir, { recursive: true });

      fs.writeFileSync(path.join(packageDir, 'SmsModule.kt'),   SMS_MODULE_KT,   'utf8');
      fs.writeFileSync(path.join(packageDir, 'SmsPackage.kt'),  SMS_PACKAGE_KT,  'utf8');
      fs.writeFileSync(path.join(packageDir, 'SmsReceiver.kt'), SMS_RECEIVER_KT, 'utf8');

      console.log('[withSmsReceiver] Wrote SmsModule.kt, SmsPackage.kt, SmsReceiver.kt');
      return config;
    },
  ]);

// ─── Step 2: Patch MainApplication.kt to register SmsPackage() ───────────────

const withSmsMainApplication = (config) =>
  withDangerousMod(config, [
    'android',
    (config) => {
      const mainAppPath = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/java/com/nexoraai/app/MainApplication.kt'
      );

      if (!fs.existsSync(mainAppPath)) {
        console.warn('[withSmsReceiver] MainApplication.kt not found — skipping patch');
        return config;
      }

      let src = fs.readFileSync(mainAppPath, 'utf8');

      // Idempotent — do not double-patch
      if (src.includes('SmsPackage()')) {
        console.log('[withSmsReceiver] MainApplication.kt already contains SmsPackage(), skipping');
        return config;
      }

      // Pattern A — expression-body form with .apply { } block (Expo SDK 50+):
      //   override fun getPackages(): List<ReactPackage> =
      //       PackageList(this).packages.apply {
      //         // add(MyPackage())
      //       }
      const patternA = /(PackageList\(this\)\.packages\.apply\s*\{)([\s\S]*?)(\})/;
      if (patternA.test(src)) {
        src = src.replace(patternA, (_, open, body, close) => {
          return `${open}${body}              add(SmsPackage())\n            ${close}`;
        });
        fs.writeFileSync(mainAppPath, src, 'utf8');
        console.log('[withSmsReceiver] Patched MainApplication.kt (pattern A — apply block)');
        return config;
      }

      // Pattern B — block-body form:
      //   val packages = PackageList(this).packages
      //   return packages
      const patternB = /(val packages = PackageList\(this\)\.packages\s*\n)([ \t]*)(return packages)/;
      if (patternB.test(src)) {
        src = src.replace(patternB, (_, decl, indent, ret) => {
          return `${decl}${indent}packages.add(SmsPackage())\n${indent}${ret}`;
        });
        fs.writeFileSync(mainAppPath, src, 'utf8');
        console.log('[withSmsReceiver] Patched MainApplication.kt (pattern B — block body)');
        return config;
      }

      // Pattern C — bare expression-body without .apply (unlikely but safe):
      //   override fun getPackages(): List<ReactPackage> =
      //       PackageList(this).packages
      const patternC = /(override fun getPackages\(\): List<ReactPackage>\s*=\s*\n?\s*)(PackageList\(this\)\.packages)/;
      if (patternC.test(src)) {
        src = src.replace(patternC, (_, decl, expr) => {
          return `${decl}${expr}.apply {\n              add(SmsPackage())\n            }`;
        });
        fs.writeFileSync(mainAppPath, src, 'utf8');
        console.log('[withSmsReceiver] Patched MainApplication.kt (pattern C — bare expression)');
        return config;
      }

      console.warn('[withSmsReceiver] Could not find getPackages() pattern in MainApplication.kt — patch skipped. Add SmsPackage() manually.');
      return config;
    },
  ]);

// ─── Step 3: Add <receiver> to AndroidManifest.xml ───────────────────────────

const withSmsManifest = (config) =>
  withAndroidManifest(config, (config) => {
    const manifest     = config.modResults;
    const application  = manifest.manifest.application?.[0];

    if (!application) return config;

    const existing = application.receiver ?? [];
    const already  = existing.some((r) => r.$?.['android:name'] === '.SmsReceiver');
    if (already) return config;

    application.receiver = [
      ...existing,
      {
        $: {
          'android:name':     '.SmsReceiver',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            $:      { 'android:priority': '999' },
            action: [{ $: { 'android:name': 'android.provider.Telephony.SMS_RECEIVED' } }],
          },
        ],
      },
    ];

    console.log('[withSmsReceiver] Registered SmsReceiver in AndroidManifest.xml');
    return config;
  });

// ─── Compose all three mods ───────────────────────────────────────────────────

const withSmsReceiver = (config) => {
  config = withSmsKotlinFiles(config);
  config = withSmsMainApplication(config);
  config = withSmsManifest(config);
  return config;
};

module.exports = withSmsReceiver;
