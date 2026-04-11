from hashlib import sha256

SCAN_TTL = 3600
LEADERBOARD_TTL = 300
VOICES_TTL = 86400
QUIZ_TTL = 43200
URL_CHECK_TTL = 3600


def scan_key(content: str) -> str:
    return f"scan:{sha256(content.encode()).hexdigest()}"


def leaderboard_key() -> str:
    return "leaderboard:top50"


def voices_key() -> str:
    return "voices:list"


def quiz_key(lesson_id: str, language: str) -> str:
    return f"quiz:{lesson_id}:{language}"


def gsb_key(url: str) -> str:
    return f"gsb:{sha256(url.encode()).hexdigest()}"


def vt_key(url: str) -> str:
    return f"vt:{sha256(url.encode()).hexdigest()}"
