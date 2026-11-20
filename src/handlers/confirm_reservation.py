"""Lambda handler: confirm a reservation.

Event:
{
  "tenantId": "t_demo_001",
  "date": "2026-11-16",
  "startTime": "19:00",
  "partySize": 4,
  "customerName": "山田太郎",
  "customerPhone": "+8190...",   // optional
  "source": "manual",            // optional: manual | ai_phone
  "callId": "...",               // optional
  "tableId": "T4-01"             // optional preferred table
}
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

_SRC = Path(__file__).resolve().parents[1]
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from booking.confirm import confirm_reservation
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
        date_s = data.get("date")
        start_time = data.get("startTime")
        party_size = data.get("partySize")
        customer_name = data.get("customerName")

        missing = [
            name
            for name, value in (
                ("tenantId", tenant_id),
                ("date", date_s),
                ("startTime", start_time),
                ("partySize", party_size),
                ("customerName", customer_name),
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

        result = confirm_reservation(
            BookingStore(),
            tenant_id=str(tenant_id),
            date_s=str(date_s),
            start_time_s=str(start_time),
            party_size=party_size_i,
            customer_name=str(customer_name),
            customer_phone=data.get("customerPhone"),
            source=str(data.get("source") or "manual"),
            call_id=data.get("callId"),
            preferred_table_id=data.get("tableId"),
        )
        payload = result.to_dict()
        http = 200
        if result.status == "confirmed":
            http = 201
        elif result.status in {"invalid_request", "invalid_slot"}:
            http = 400
        elif result.status == "not_found":
            http = 404
        elif result.status == "full":
            http = 409
        return _response(http, payload)
    except Exception as exc:  # noqa: BLE001
        return _response(500, {"status": "error", "reason": str(exc)})
