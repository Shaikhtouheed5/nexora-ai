"""
Telegram bot webhook router.
Handles /start <user_id> to link accounts and auto-scans incoming messages.

Setup:
  1. Create a Telegram bot via @BotFather → get TELEGRAM_BOT_TOKEN
  2. Deploy and set webhook:
     curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
          -d url=https://your-edu-service.onrender.com/telegram/webhook
"""

import os
import httpx
from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/telegram", tags=["telegram"])

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
SCANNER_API_BASE = os.environ.get("SCANNER_API_BASE", "https://phishguard-2-sgzd.onrender.com")


async def send_telegram_message(chat_id: int, text: str):
    """Send a message to a Telegram user via Bot API."""
    if not TELEGRAM_BOT_TOKEN:
        return
    async with httpx.AsyncClient() as client:
        await client.post(
            f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
            json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
            timeout=10,
        )


async def link_telegram_account(user_id: str, chat_id: int):
    """Upsert telegram_connections row in Supabase."""
    try:
        from services.supabase_client import get_supabase_client
        sb = get_supabase_client()
        sb.table("telegram_connections").upsert(
            {"user_id": user_id, "telegram_chat_id": chat_id},
            on_conflict="user_id",
        ).execute()
    except Exception as e:
        print(f"[telegram] link_telegram_account failed: {e}")


async def scan_text_via_api(text: str) -> Optional[dict]:
    """Call the scanner service /scan/text endpoint."""
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"{SCANNER_API_BASE}/scan/text",
                json={"text": text},
                timeout=20,
            )
            return res.json()
    except Exception as e:
        print(f"[telegram] scan_text_via_api failed: {e}")
        return None


@router.post("/webhook")
async def telegram_webhook(request: Request):
    """Receive updates from Telegram Bot API."""
    update = await request.json()

    message = update.get("message", {})
    text = message.get("text", "")
    chat_id = message.get("chat", {}).get("id")

    if not chat_id:
        return {"ok": True}

    if text.startswith("/start"):
        parts = text.split(" ", 1)
        user_id = parts[1].strip() if len(parts) > 1 else None

        if user_id:
            await link_telegram_account(user_id, chat_id)
            await send_telegram_message(
                chat_id,
                "✅ <b>Telegram connected to NexoraAI!</b>\n\n"
                "Forward me any suspicious message and I'll scan it for phishing threats instantly. 🛡️",
            )
        else:
            await send_telegram_message(
                chat_id,
                "👋 Welcome to <b>NexoraAI Bot</b>!\n\n"
                "Open the NexoraAI app → Monitor → Connect Telegram to link your account.",
            )

    elif text and not text.startswith("/"):
        # Auto-scan any forwarded message
        result = await scan_text_via_api(text)

        if result is None:
            await send_telegram_message(chat_id, "⚠️ Scanner is temporarily unavailable. Try again shortly.")
        else:
            risk = result.get("riskLevel", "SAFE")
            score = result.get("score", 0)
            reasons = result.get("reasons", [])
            reasons_text = "\n".join(f"• {r}" for r in reasons[:3]) if reasons else "No specific indicators."

            if risk == "MALICIOUS":
                emoji = "🔴"
                label = "CRITICAL THREAT DETECTED"
            elif risk == "SUSPICIOUS":
                emoji = "🟡"
                label = "SUSPICIOUS MESSAGE"
            else:
                emoji = "🟢"
                label = "MESSAGE APPEARS SAFE"

            reply = (
                f"{emoji} <b>{label}</b>\n"
                f"Confidence: {score}/100\n\n"
                f"<b>Patterns detected:</b>\n{reasons_text}\n\n"
                f"<i>Powered by NexoraAI</i>"
            )
            await send_telegram_message(chat_id, reply)

    return {"ok": True}
