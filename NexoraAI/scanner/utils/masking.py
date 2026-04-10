import re


def mask_email(email: str) -> str:
    if "@" not in email:
        return "***"
    local, domain = email.split("@", 1)
    return f"{local[0]}{'*' * max(len(local) - 1, 3)}@{domain}"


def mask_url(url: str) -> str:
    return re.sub(r"(\?.*)$", "?[REDACTED]", url)


def mask_api_key(key: str) -> str:
    return f"{key[:6]}{'*' * 20}" if len(key) > 6 else "***"
