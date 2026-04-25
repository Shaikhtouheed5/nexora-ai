import os
import sys

# Add backend/ root to sys.path so imports work from any working directory.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Must be set before any app module is imported — pydantic-settings reads env at
# class definition time when the Settings instance is created.
_TEST_ENV = {
    "SUPABASE_URL": "https://test.supabase.co",
    "SUPABASE_SERVICE_ROLE_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test",
    "SUPABASE_JWT_SECRET": "test-jwt-secret-must-be-at-least-32-characters-long",
    "REDIS_URL": "rediss://test.upstash.io",
    "REDIS_TOKEN": "test-redis-token",
    "GEMINI_API_KEY": "test-gemini-api-key",
    "ELEVENLABS_API_KEY": "test-elevenlabs-api-key",
    "GOOGLE_SAFE_BROWSING_API_KEY": "test-gsb-api-key",
    "GOOGLE_VISION_API_KEY": "test-vision-api-key",
    "VIRUSTOTAL_API_KEY": "test-virustotal-api-key",
    "SECRET_KEY": "test-secret-key-must-be-at-least-32-characters-long",
}
for _k, _v in _TEST_ENV.items():
    os.environ.setdefault(_k, _v)

import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient

from main import app
from core.dependencies import get_current_user

_FAKE_USER = {"sub": "00000000-0000-0000-0000-000000000001", "email": "test@example.com"}

MOCK_SCAN_RESULT = {
    "verdict": "malicious",
    "confidence": 0.95,
    "threat_type": "smishing",
    "explanation": "Phishing link detected",
    "flags": ["suspicious_url"],
    "riskLevel": "MALICIOUS",
    "score": 95,
    "safe_browsing_result": None,
    "virustotal_result": None,
}


@pytest.fixture
def mock_scanner():
    scanner = MagicMock()
    scanner.scan = AsyncMock(return_value=MOCK_SCAN_RESULT)
    return scanner


@pytest.fixture
def client(mock_scanner):
    app.dependency_overrides[get_current_user] = lambda: _FAKE_USER
    # TestClient.__enter__ runs the lifespan (sets app.state.scanner = ScannerEngine()).
    # We overwrite it immediately after with our mock so no real engine calls happen.
    with TestClient(app, raise_server_exceptions=True) as c:
        app.state.scanner = mock_scanner
        yield c
    app.dependency_overrides.clear()
