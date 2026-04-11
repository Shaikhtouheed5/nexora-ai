import re
from typing import Tuple

URGENCY_PATTERNS = [
    r"\burgent\b", r"\bimmediately\b", r"\baccount suspended\b",
    r"\bverify now\b", r"\bclick here\b", r"\blimited time\b",
    r"\bact now\b", r"\bexpire[sd]?\b", r"\bblocked\b",
    r"अभी", r"तुरंत", r"खाता बंद", r"OTP share", r"OTP दर्ज",
]

BANK_PATTERNS = [
    r"\bHDFC\b", r"\bSBI\b", r"\bICICI\b", r"\bAxis\b", r"\bKotak\b",
    r"\bPaytm\b", r"\bGPay\b", r"\bPhonePe\b", r"\bNPCI\b",
    r"\bUPI\b", r"\bRBI\b", r"\bNEFT\b", r"\bIMPS\b",
]

BANK_ACTION_PATTERNS = [
    r"\bverify\b", r"\bupdate\b", r"\bconfirm\b", r"\blogin\b",
    r"\bblock\b", r"\bsuspend\b", r"\bfrozen\b",
]

SUSPICIOUS_TLDS = [
    r"\.xyz\b", r"\.tk\b", r"\.ml\b", r"\.ga\b", r"\.cf\b",
    r"\.gq\b", r"\.top\b", r"\.click\b", r"\.work\b",
]

OTP_PATTERNS = [
    r"\benter OTP\b", r"\bverify OTP\b", r"\bshare OTP\b",
    r"OTP है", r"OTP भेजें",
]

CREDENTIAL_PATTERNS = [
    r"\benter password\b", r"\blogin to verify\b", r"\bconfirm your details\b",
    r"\bupdate KYC\b", r"\bKYC pending\b", r"\bverify your account\b",
]


def check(content: str, content_type: str) -> Tuple[float, list]:
    """Returns (confidence, flags)"""
    text = content.lower()
    confidence = 0.0
    flags = []

    def match(patterns, name, weight):
        nonlocal confidence
        for p in patterns:
            if re.search(p, content, re.IGNORECASE):
                confidence += weight
                if name not in flags:
                    flags.append(name)
                break

    match(URGENCY_PATTERNS, "urgency_language", 0.25)
    match(OTP_PATTERNS, "otp_harvesting", 0.35)
    match(CREDENTIAL_PATTERNS, "credential_harvesting", 0.35)
    match(SUSPICIOUS_TLDS, "suspicious_tld", 0.30)

    # Bank + action combo scores higher
    has_bank = any(re.search(p, content, re.IGNORECASE) for p in BANK_PATTERNS)
    has_action = any(re.search(p, content, re.IGNORECASE) for p in BANK_ACTION_PATTERNS)
    if has_bank and has_action:
        confidence += 0.30
        flags.append("bank_impersonation")
    elif has_bank:
        confidence += 0.10

    return min(confidence, 1.0), flags
