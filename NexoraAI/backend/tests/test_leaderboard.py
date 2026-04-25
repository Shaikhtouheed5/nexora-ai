"""
TDD tests for GET /edu/leaderboard — Phase C (Leaderboard fix).

Written BEFORE implementation. All tests FAIL until:
  - GET /edu/leaderboard is rewritten to query `users` table
  - Response shape is { top_users: [...], user_rank: {...} }
  - top_users items include a rank field
  - user_rank is computed (from list or count query)

Run from backend/:
    pytest tests/test_leaderboard.py -v
"""
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app
from core.dependencies import get_current_user

# ── Constants ─────────────────────────────────────────────────────────────────

_UID       = "00000000-0000-0000-0000-000000000001"
_OTHER_ID  = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
_THIRD_ID  = "cccccccc-cccc-cccc-cccc-cccccccccccc"

_FAKE_USER = {"sub": _UID, "email": "test@example.com"}

_ENDPOINT = "/edu/leaderboard"

# Sample rows as returned by Supabase from the `users` table
_ROW_OTHER = {"id": _OTHER_ID, "name": "Alice",     "xp": 900, "level": 5, "avatar_url": None}
_ROW_THIRD = {"id": _THIRD_ID, "name": "Bob",       "xp": 700, "level": 4, "avatar_url": None}
_ROW_SELF  = {"id": _UID,      "name": "Test User", "xp": 500, "level": 3, "avatar_url": None}


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


# ── Supabase mock helpers ─────────────────────────────────────────────────────

def _sb_top50(rows):
    """Mock: single table call returning the top-50 ordered list."""
    sb = MagicMock()
    q = MagicMock()
    q.select.return_value = q
    q.order.return_value = q
    q.limit.return_value = q
    q.execute.return_value.data = rows
    sb.table.return_value = q
    return sb


def _sb_outside_top50(top_rows, user_row, count_above):
    """
    Mock: user is NOT in top_rows.
    Call sequence:
      1. top-50 SELECT → top_rows
      2. user's own row SELECT → user_row
      3. count query (users with xp > user_xp) → count_above
    """
    call_counts = {"n": 0}

    def _table(_name):
        call_counts["n"] += 1
        q = MagicMock()
        if call_counts["n"] == 1:
            q.select.return_value = q
            q.order.return_value = q
            q.limit.return_value = q
            q.execute.return_value.data = top_rows
        elif call_counts["n"] == 2:
            q.select.return_value = q
            q.eq.return_value = q
            q.single.return_value = q
            q.execute.return_value.data = user_row
        else:
            q.select.return_value = q
            q.gt.return_value = q
            q.execute.return_value.count = count_above
        return q

    sb = MagicMock()
    sb.table.side_effect = _table
    return sb


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestEduLeaderboard:

    def test_returns_wrapped_shape_not_bare_array(self, auth_client):
        """Response must be { top_users: [...], user_rank: {...|null} }, NOT a list."""
        sb = _sb_top50([_ROW_OTHER, _ROW_SELF])
        with patch("routers.edu.supabase", sb), \
             patch("routers.edu.get_cache", return_value=None), \
             patch("routers.edu.set_cache"):
            resp = auth_client.get(_ENDPOINT)

        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, dict), "Response must be a dict, not a list"
        assert "top_users" in body
        assert "user_rank" in body
        assert isinstance(body["top_users"], list)

    def test_top_users_have_rank_field(self, auth_client):
        """Each entry in top_users must have a rank field (1-indexed, ascending)."""
        sb = _sb_top50([_ROW_OTHER, _ROW_THIRD, _ROW_SELF])
        with patch("routers.edu.supabase", sb), \
             patch("routers.edu.get_cache", return_value=None), \
             patch("routers.edu.set_cache"):
            resp = auth_client.get(_ENDPOINT)

        top = resp.json()["top_users"]
        assert len(top) == 3
        assert top[0]["rank"] == 1
        assert top[1]["rank"] == 2
        assert top[2]["rank"] == 3

    def test_top_users_have_display_name(self, auth_client):
        """display_name field must be present (mapped from users.name)."""
        sb = _sb_top50([_ROW_OTHER, _ROW_SELF])
        with patch("routers.edu.supabase", sb), \
             patch("routers.edu.get_cache", return_value=None), \
             patch("routers.edu.set_cache"):
            resp = auth_client.get(_ENDPOINT)

        top = resp.json()["top_users"]
        assert top[0]["display_name"] == "Alice"
        assert top[1]["display_name"] == "Test User"

    def test_user_rank_in_top50_returns_correct_position(self, auth_client):
        """When user is in top 50, user_rank.rank equals their list position."""
        sb = _sb_top50([_ROW_OTHER, _ROW_THIRD, _ROW_SELF])
        with patch("routers.edu.supabase", sb), \
             patch("routers.edu.get_cache", return_value=None), \
             patch("routers.edu.set_cache"):
            resp = auth_client.get(_ENDPOINT)

        user_rank = resp.json()["user_rank"]
        assert user_rank is not None
        assert user_rank["id"] == _UID
        assert user_rank["rank"] == 3
        assert user_rank["xp"] == 500

    def test_user_rank_outside_top50_uses_count_query(self, auth_client):
        """
        When user is NOT in top 50, rank = count(users with xp > user_xp) + 1.
        top_rows has 2 users (neither is _UID), count_above=55 → rank=56.
        """
        top_rows  = [_ROW_OTHER, _ROW_THIRD]
        user_row  = _ROW_SELF
        count_above = 55

        sb = _sb_outside_top50(top_rows, user_row, count_above)
        with patch("routers.edu.supabase", sb), \
             patch("routers.edu.get_cache", return_value=None), \
             patch("routers.edu.set_cache"):
            resp = auth_client.get(_ENDPOINT)

        body = resp.json()
        assert len(body["top_users"]) == 2
        user_rank = body["user_rank"]
        assert user_rank is not None
        assert user_rank["rank"] == 56
        assert user_rank["xp"] == 500

    def test_unauthenticated_returns_403(self, anon_client):
        """No auth header → HTTPBearer raises 403."""
        resp = anon_client.get(_ENDPOINT)
        assert resp.status_code in (401, 403)
