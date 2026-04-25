"""
TDD tests for POST /scan/image.

Written BEFORE implementation — all tests should FAIL (ImportError or AssertionError)
until services/vision_client.py and the /image endpoint in routers/scanner.py exist.

Run from backend/:
    pytest tests/test_image_scan.py -v
"""
import base64
from unittest.mock import AsyncMock, patch

import pytest

# ---------------------------------------------------------------------------
# Test data helpers
# ---------------------------------------------------------------------------

def _b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode()


# Minimal JPEG: SOI marker (FF D8 FF E0) + enough padding to pass size check
JPEG_B64 = _b64(b"\xff\xd8\xff\xe0" + b"\x00" * 200)

# Minimal PNG: PNG signature + enough padding
PNG_B64 = _b64(b"\x89PNG\r\n\x1a\n" + b"\x00" * 200)

# GIF (unsupported — not JPEG or PNG)
GIF_B64 = _b64(b"GIF89a" + b"\x00" * 200)

# Invalid base64 characters
INVALID_B64 = "!!!notvalidbase64!!!"

# Over the 6_710_886-char limit (all-A is valid base64 that decodes to null bytes,
# but size check fires first so magic-byte check is never reached)
OVERSIZED_B64 = "A" * 7_000_001

# Extracted text to feed into the scanner
PHISH_TEXT = "URGENT: Your SBI account will be blocked. Verify now: http://sbi-kyc.xyz"

_ENDPOINT = "/scan/image"


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestScanImageEndpoint:
    """POST /scan/image — unified OCR + threat scan."""

    # ── Happy paths ─────────────────────────────────────────────────────────

    def test_valid_jpeg_ocr_to_scan_result(self, client, mock_scanner):
        """JPEG base64 → Vision extracts text → engine.scan returns ScanResult."""
        with patch(
            "routers.scanner.extract_text_from_base64",
            new=AsyncMock(return_value=PHISH_TEXT),
        ):
            resp = client.post(_ENDPOINT, json={"image": JPEG_B64})

        assert resp.status_code == 200
        body = resp.json()
        assert body["verdict"] == "malicious"
        assert "confidence" in body
        assert "riskLevel" in body
        mock_scanner.scan.assert_awaited_once_with(PHISH_TEXT, "image", "en")

    def test_valid_png_ocr_to_scan_result(self, client, mock_scanner):
        """PNG base64 → same full pipeline as JPEG."""
        with patch(
            "routers.scanner.extract_text_from_base64",
            new=AsyncMock(return_value=PHISH_TEXT),
        ):
            resp = client.post(_ENDPOINT, json={"image": PNG_B64})

        assert resp.status_code == 200
        assert resp.json()["verdict"] == "malicious"
        mock_scanner.scan.assert_awaited_once()

    # ── Validation failures ──────────────────────────────────────────────────

    def test_oversized_payload_returns_400(self, client):
        """Payload > 6_710_886 bytes → 400 with '5 MB' in detail."""
        resp = client.post(_ENDPOINT, json={"image": OVERSIZED_B64})

        assert resp.status_code == 400
        assert "5 MB" in resp.json()["detail"]

    def test_unsupported_format_returns_400(self, client):
        """GIF magic bytes → 400 'Unsupported image format'."""
        resp = client.post(_ENDPOINT, json={"image": GIF_B64})

        assert resp.status_code == 400
        assert "Unsupported image format" in resp.json()["detail"]

    def test_malformed_base64_returns_400(self, client):
        """Non-base64 characters → 400 'Invalid base64 encoding'."""
        resp = client.post(_ENDPOINT, json={"image": INVALID_B64})

        assert resp.status_code == 400
        assert "Invalid base64" in resp.json()["detail"]

    # ── OCR edge cases ───────────────────────────────────────────────────────

    def test_vision_no_text_returns_safe_result(self, client, mock_scanner):
        """Vision returns '' → immediate safe response, engine.scan NOT called."""
        with patch(
            "routers.scanner.extract_text_from_base64",
            new=AsyncMock(return_value=""),
        ):
            resp = client.post(_ENDPOINT, json={"image": JPEG_B64})

        assert resp.status_code == 200
        body = resp.json()
        assert body["verdict"] == "safe"
        assert body["riskLevel"] == "SAFE"
        assert body["explanation"] == "No text found in image"
        assert body["score"] == 0
        mock_scanner.scan.assert_not_awaited()

    def test_vision_failure_returns_503(self, client):
        """Vision raises RuntimeError → 503 'OCR service unavailable'."""
        with patch(
            "routers.scanner.extract_text_from_base64",
            new=AsyncMock(side_effect=RuntimeError("Vision API 500: Internal error")),
        ):
            resp = client.post(_ENDPOINT, json={"image": JPEG_B64})

        assert resp.status_code == 503
        assert "OCR service unavailable" in resp.json()["detail"]
