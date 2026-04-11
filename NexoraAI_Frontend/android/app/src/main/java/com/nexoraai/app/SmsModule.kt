package com.nexoraai.app

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
                "date DESC"   // newest first; we stop after 50 rows below
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
                    // date is Unix epoch in milliseconds — send as Double (JS number)
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
