"""Connect/Lex turn handler for reservation dialog.

Accepts either:
  - Connect Lambda event (Details.Parameters + ContactData.Attributes)
  - Lex V2 code-hook event
  - Direct JSON for local tests
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
from booking.dialog import handle_reservation_turn, state_from_dict


def _attrs(event: dict[str, Any]) -> dict[str, Any]:
    details = event.get("Details") or {}
    contact = details.get("ContactData") or {}
    params = details.get("Parameters") or {}
    attrs = dict(contact.get("Attributes") or {})
    attrs.update(params)
    if event.get("sessionState"):
        # Lex V2
        sess = event["sessionState"].get("sessionAttributes") or {}
        attrs.update(sess)
        interpretations = event.get("interpretations") or []
        if interpretations:
            input_transcript = event.get("inputTranscript") or ""
            attrs.setdefault("utterance", input_transcript)
    if "body" in event and isinstance(event["body"], str):
        try:
            attrs.update(json.loads(event["body"] or "{}"))
        except json.JSONDecodeError:
            pass
    for k in ("tenantId", "utterance", "dtmf", "phase", "date", "time", "partySize", "name"):
        if k in event and k not in attrs:
            attrs[k] = event[k]
    return attrs


def _lex_response(result: dict[str, Any], event: dict[str, Any]) -> dict[str, Any]:
    session = dict((event.get("sessionState") or {}).get("sessionAttributes") or {})
    session.update({k: str(v) for k, v in result.items() if k != "prompt"})
    session["prompt"] = result.get("prompt") or ""
    msg = result.get("prompt") or ""
    intent_name = (
        ((event.get("sessionState") or {}).get("intent") or {}).get("name")
        or "BookReservation"
    )
    dialog_action = {"type": "ElicitIntent"}
    if result.get("action") == "confirm_dtmf":
        dialog_action = {"type": "ElicitSlot", "slotToElicit": "Confirmation"}
    elif result.get("phase") == "done":
        dialog_action = {"type": "Close"}
    return {
        "sessionState": {
            "sessionAttributes": session,
            "dialogAction": dialog_action,
            "intent": {
                "name": intent_name,
                "state": "Fulfilled" if result.get("phase") == "done" else "InProgress",
            },
        },
        "messages": [{"contentType": "PlainText", "content": msg}],
    }


def handler(event: dict[str, Any] | None = None, context: Any = None) -> dict[str, Any]:
    event = event or {}
    attrs = _attrs(event)
    tenant_id = str(attrs.get("tenantId") or "")
    utterance = str(attrs.get("utterance") or attrs.get("inputTranscript") or "")
    dtmf = attrs.get("dtmf") or attrs.get("StoredCustomerInput") or None
    if dtmf is not None:
        dtmf = str(dtmf)

    state_keys = (
        "date",
        "time",
        "partySize",
        "name",
        "phase",
        "lastPrompt",
        "resultStatus",
        "reservationId",
        "missing",
    )
    state_data = {k: attrs.get(k) for k in state_keys if attrs.get(k) not in (None, "")}
    if isinstance(state_data.get("missing"), str):
        state_data["missing"] = [
            x for x in str(state_data["missing"]).split(",") if x
        ]

    caller_available = str(attrs.get("callerNumberAvailable") or "").lower() == "true"
    result = handle_reservation_turn(
        BookingStore(),
        tenant_id=tenant_id,
        utterance=utterance,
        state_data=state_data,
        dtmf=dtmf,
        caller_number=attrs.get("callerNumber"),
        caller_number_available=caller_available,
    )

    if event.get("sessionState") is not None or event.get("bot") is not None:
        return _lex_response(result, event)

    # Connect STRING_MAP / direct invoke
    flat = {k: ("" if v is None else str(v)) for k, v in result.items()}
    return flat
