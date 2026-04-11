package com.nexoraai.app

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
