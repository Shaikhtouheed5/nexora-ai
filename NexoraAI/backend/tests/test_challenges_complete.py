"""
TDD tests for POST /challenges/{challenge_id}/complete.

Written BEFORE implementation — all tests FAIL until:
  - POST /{challenge_id}/complete is added to routers/challenges.py

Run from backend/:
    pytest tests/test_challenges_complete.py -v
"""
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app
from core.dependencies import get_current_user

# ── Test data ─────────────────────────────────────────────────────────────────

_FAKE_USER = {"sub": "00000000-0000-0000-0000-000000000001", "email": "test@example.com"}
_UID = "00000000-0000-0000-0000-000000000001"

CHALLENGE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

_SCAN_CHALLENGE = {
    "id": CHALLENGE_ID,
    "title": "Suspicious SMS",
    "description": "Scan this message for phishing",
    "type": "scan",
    "difficulty": "easy",
    "xp_reward": 10,
}

_QUIZ_CHALLENGE = {
    "id": CHALLENGE_ID,
    "title": "Phishing Quiz",
    "description": "Answer the quiz",
    "type": "quiz",
    "difficulty": "easy",
    "xp_reward": 10,
}

_ENDPOINT = f"/challenges/{CHALLENGE_ID}/complete"


# ── Supabase mock factory ─────────────────────────────────────────────────────

def _make_supabase(challenge_data, progress_data):
    """
    Route .table("challenges") to SELECT-single mock.
    Route .table("user_challenge_progress"):
      - 1st call (SELECT idempotency check) → returns progress_data
      - 2nd call (INSERT) → returns new row
    """
    call_counts = {"ucp": 0}

    def _table(name):
        if name == "challenges":
            m = MagicMock()
            m.select.return_value.eq.return_value.single.return_value.execute.return_value.data = challenge_data
            return m
        if name == "user_challenge_progress":
            call_counts["ucp"] += 1
            q = MagicMock()
            if call_counts["ucp"] == 1:
                # SELECT: select().eq().eq().gte().lt().execute()
                q.select.return_value = q
                q.eq.return_value = q
                q.gte.return_value = q
                q.lt.return_value = q
                q.execute.return_value.data = progress_data
            else:
                # INSERT
                q.insert.return_value.execute.return_value.data = [{"id": "new-row"}]
            return q
        return MagicMock()

    sb = MagicMock()
    sb.table.side_effect = _table
    sb.rpc.return_value.execute.return_value = MagicMock()
    return sb


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def auth_client():
    app.dependency_overrides[get_current_user] = lambda: _FAKE_USER
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def anon_client():
    app.dependency_overrides.clear()
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestChallengeComplete:

    @pytest.fixture(autouse=True)
    def _bypass_token(self):
        with patch("routers.challenges._verify_scan_token", return_value=True):
            yield

    def test_scan_malicious_awards_xp(self, auth_client):
        """Malicious verdict on a scan challenge → xp_earned = xp_reward, rpc called."""
        sb = _make_supabase(_SCAN_CHALLENGE, [])
        with patch("routers.challenges.supabase", sb):
            resp = auth_client.post(_ENDPOINT, json={"verdict": "malicious"})

        assert resp.status_code == 200
        body = resp.json()
        assert body["xp_earned"] == 10
        assert body["already_completed"] is False
        sb.rpc.assert_called_once_with(
            "increment_xp", {"user_id": _UID, "xp_amount": 10}
        )

    def test_scan_suspicious_awards_xp(self, auth_client):
        """Suspicious verdict also earns XP."""
        sb = _make_supabase(_SCAN_CHALLENGE, [])
        with patch("routers.challenges.supabase", sb):
            resp = auth_client.post(_ENDPOINT, json={"verdict": "suspicious"})

        assert resp.status_code == 200
        data = resp.json()
        assert data["xp_earned"] == 10
        assert data["already_completed"] is False
        sb.rpc.assert_called_once()

    def test_scan_safe_no_xp(self, auth_client):
        """Safe verdict on scan challenge → xp_earned = 0, rpc NOT called."""
        sb = _make_supabase(_SCAN_CHALLENGE, [])
        with patch("routers.challenges.supabase", sb):
            resp = auth_client.post(_ENDPOINT, json={"verdict": "safe"})

        assert resp.status_code == 200
        data = resp.json()
        assert data["xp_earned"] == 0
        assert data["already_completed"] is False
        sb.rpc.assert_not_called()

    def test_already_completed_today_idempotent(self, auth_client):
        """If progress row exists for today, return 0 XP without re-awarding."""
        sb = _make_supabase(_SCAN_CHALLENGE, [{"id": "existing-row"}])
        with patch("routers.challenges.supabase", sb):
            resp = auth_client.post(_ENDPOINT, json={"verdict": "malicious"})

        assert resp.status_code == 200
        data = resp.json()
        assert data["xp_earned"] == 0
        assert data["already_completed"] is True
        sb.rpc.assert_not_called()

    def test_non_scan_type_returns_400(self, auth_client):
        """Quiz/scenario challenges cannot be completed via this endpoint → 400."""
        sb = _make_supabase(_QUIZ_CHALLENGE, [])
        with patch("routers.challenges.supabase", sb):
            resp = auth_client.post(_ENDPOINT, json={"verdict": "malicious"})

        assert resp.status_code == 400

    def test_unauthenticated_returns_403(self, anon_client):
        """No auth header → 403 (HTTPBearer auto_error=True)."""
        resp = anon_client.post(_ENDPOINT, json={"verdict": "malicious"})
        assert resp.status_code in (401, 403)

    def test_invalid_challenge_id_returns_404(self, auth_client):
        """Unknown challenge_id → 404."""
        sb = _make_supabase(None, [])
        with patch("routers.challenges.supabase", sb):
            resp = auth_client.post(
                "/challenges/nonexistent-id/complete",
                json={"verdict": "malicious"},
            )
        assert resp.status_code == 404
