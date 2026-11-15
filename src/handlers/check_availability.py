"""Lambda handler: check reservation availability.

Event (direct invoke or API Gateway JSON body):
{
  "tenantId": "t_demo_001",
  "date": "2026-11-17",
  "startTime": "19:00",
  "partySize": 4
}
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

# Allow `src/` imports when running as a script or Lambda with src on PYTHONPATH.
_SRC = Path(__file__).resolve().parents[1]
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from booking.availability import check_availability
from booking.db import BookingStore


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
        "headers": {"Content-Type": "application/json; charset=utf-8"},
        "body": json.dumps(payload, ensure_ascii=False),
    }


def handler(event: dict[str, Any] | None = None, context: Any = None) -> dict[str, Any]:
    try:
        data = _parse_body(event or {})
        tenant_id = data.get("tenantId")
        date_s = data.get("date")
        start_time = data.get("startTime")
        party_size = data.get("partySize")

        missing = [
            name
            for name, value in (
                ("tenantId", tenant_id),
                ("date", date_s),
                ("startTime", start_time),
                ("partySize", party_size),
            )
            if value is None or value == ""
        ]
        if missing:
            return _response(
                400,
                {"status": "invalid_request", "reason": "missing_fields", "fields": missing},
            )

        try:
            party_size_i = int(party_size)
        except (TypeError, ValueError):
            return _response(
                400,
                {"status": "invalid_request", "reason": "invalid_party_size"},
            )

        result = check_availability(
            BookingStore(),
            tenant_id=str(tenant_id),
            date_s=str(date_s),
            start_time_s=str(start_time),
            party_size=party_size_i,
        )
        payload = result.to_dict()
        http = 200
        if result.status in {"invalid_request", "invalid_slot"}:
            http = 400
        elif result.status == "not_found":
            http = 404
        return _response(http, payload)
    except Exception as exc:  # noqa: BLE001 - Lambda boundary
        return _response(500, {"status": "error", "reason": str(exc)})
