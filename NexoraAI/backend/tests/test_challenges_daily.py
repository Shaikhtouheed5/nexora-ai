"""
TDD tests for GET /challenges/daily.

Written BEFORE implementation — all tests FAIL until:
  - GET /daily is added to routers/challenges.py
  - user_challenge_progress table logic is implemented

Run from backend/:
    pytest tests/test_challenges_daily.py -v
"""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app
from core.dependencies import get_current_user

# ── Test data ────────────────────────────────────────────────────────────────

_FAKE_USER = {"sub": "00000000-0000-0000-0000-000000000001", "email": "test@example.com"}

FAKE_CHALLENGE = {
    "id": "aaaaaaaa-0000-0000-0000-000000000001",
    "title": "Spot the Phish",
    "description": "Identify the phishing email in the inbox.",
    "type": "scan",
    "difficulty": "easy",
    "xp_reward": 10,
    "created_at": "2024-01-01T00:00:00+00:00",
}

FAKE_PROGRESS_ROW = [{"id": "bbbbbbbb-0000-0000-0000-000000000001"}]

_ENDPOINT = "/challenges/daily"


# ── Supabase mock factory ─────────────────────────────────────────────────────

def _make_supabase(challenges_data, progress_data):
    """
    Build a supabase mock that routes .table("X") to per-table mock chains.
    challenges: .select("*").execute()
    user_challenge_progress: .select("id").eq().eq().gte().lt().execute()
    """
    def _table(table_name):
        if table_name == "challenges":
            m = MagicMock()
            m.select.return_value.execute.return_value.data = challenges_data
            return m
        if table_name == "user_challenge_progress":
            # Fluent chain: select → eq → eq → gte → lt → execute
            q = MagicMock()
            q.select.return_value = q
            q.eq.return_value = q
            q.gte.return_value = q
            q.lt.return_value = q
            q.execute.return_value.data = progress_data
            return q
        return MagicMock()

    sb = MagicMock()
    sb.table.side_effect = _table
    return sb


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def auth_client():
    """Client with auth dependency overridden to _FAKE_USER."""
    app.dependency_overrides[get_current_user] = lambda: _FAKE_USER
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def anon_client():
    """Client with no auth override — used to verify auth is enforced."""
    app.dependency_overrides.clear()
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


# ── Tests ────────────────────────────────────────────────────────────────────

class TestDailyChallenge:

    # ── Happy paths ──────────────────────────────────────────────────────────

    def test_daily_returns_correct_challenge_shape(self, auth_client):
        """GET /challenges/daily returns full challenge shape for auth user."""
        with patch("routers.challenges.supabase", _make_supabase([FAKE_CHALLENGE], [])):
            resp = auth_client.get(_ENDPOINT)

        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == FAKE_CHALLENGE["id"]
        assert body["title"] == FAKE_CHALLENGE["title"]
        assert body["type"] == FAKE_CHALLENGE["type"]
        assert body["difficulty"] == FAKE_CHALLENGE["difficulty"]
        assert body["xp_reward"] == FAKE_CHALLENGE["xp_reward"]
        assert "completed" in body
        assert isinstance(body["completed"], bool)

    def test_daily_completed_true_when_progress_row_exists_today(self, auth_client):
        """completed=true when user_challenge_progress row exists for IST today."""
        with patch("routers.challenges.supabase", _make_supabase([FAKE_CHALLENGE], FAKE_PROGRESS_ROW)):
            resp = auth_client.get(_ENDPOINT)

        assert resp.status_code == 200
        assert resp.json()["completed"] is True

    def test_daily_completed_false_when_no_progress_row(self, auth_client):
        """completed=false when no user_challenge_progress row for today."""
        with patch("routers.challenges.supabase", _make_supabase([FAKE_CHALLENGE], [])):
            resp = auth_client.get(_ENDPOINT)

        assert resp.status_code == 200
        assert resp.json()["completed"] is False

    # ── Auth enforcement ─────────────────────────────────────────────────────

    def test_daily_no_auth_header_returns_403(self, anon_client):
        """HTTPBearer raises 403 when Authorization header is missing."""
        resp = anon_client.get(_ENDPOINT)
        # HTTPBearer(auto_error=True) returns 403 on missing header;
        # decode_token raises 401 on invalid token.
        assert resp.status_code in (401, 403)

    # ── Edge cases ───────────────────────────────────────────────────────────

    def test_daily_empty_pool_returns_404(self, auth_client):
        """404 with 'No challenges available' when challenges table is empty."""
        with patch("routers.challenges.supabase", _make_supabase([], [])):
            resp = auth_client.get(_ENDPOINT)

        assert resp.status_code == 404
        assert "No challenges available" in resp.json()["detail"]
