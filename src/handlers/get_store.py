"""Lambda handler: get store settings for admin UI.

Event:
{ "tenantId": "t_demo_001" }
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

_SRC = Path(__file__).resolve().parents[1]
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from booking.db import BookingStore
from booking.store_view import get_store


def _parse_body(event: dict[str, Any]) -> dict[str, Any]:
    if not event:
        return {}
    if "body" in event:
        body = event["body"]
        if event.get("isBase64Encoded"):
            import base64

            body = base64.b64decode(body).decode("utf-8")
        if isinstance(body, str):
            return json.loads(body or "{}")
        return body or {}
    return event


def _response(status_code: int, payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "content-type",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
        },
        "body": json.dumps(payload, ensure_ascii=False),
    }


def handler(event: dict[str, Any] | None = None, context: Any = None) -> dict[str, Any]:
    try:
        data = _parse_body(event or {})
        tenant_id = data.get("tenantId")
        if not tenant_id:
            return _response(
                400,
                {"status": "invalid_request", "reason": "missing_fields", "fields": ["tenantId"]},
            )
        result = get_store(BookingStore(), str(tenant_id))
        http = 200 if result.get("status") == "ok" else 404
        return _response(http, result)
    except Exception as exc:  # noqa: BLE001
        return _response(500, {"status": "error", "reason": str(exc)})
