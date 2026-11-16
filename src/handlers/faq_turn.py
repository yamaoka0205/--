"""Connect/Lex turn handler for FAQ questions."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

_SRC = Path(__file__).resolve().parents[1]
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from booking.db import BookingStore
from booking.faq import answer_faq


def _attrs(event: dict[str, Any]) -> dict[str, Any]:
    details = event.get("Details") or {}
    contact = details.get("ContactData") or {}
    params = details.get("Parameters") or {}
    attrs = dict(contact.get("Attributes") or {})
    attrs.update(params)
    if event.get("inputTranscript"):
        attrs.setdefault("utterance", event["inputTranscript"])
    if event.get("sessionState"):
        attrs.update(event["sessionState"].get("sessionAttributes") or {})
    if "body" in event and isinstance(event["body"], str):
        try:
            attrs.update(json.loads(event["body"] or "{}"))
        except json.JSONDecodeError:
            pass
    for k in ("tenantId", "utterance"):
        if k in event:
            attrs.setdefault(k, event[k])
    return attrs


def handler(event: dict[str, Any] | None = None, context: Any = None) -> dict[str, Any]:
    event = event or {}
    attrs = _attrs(event)
    tenant_id = str(attrs.get("tenantId") or "")
    utterance = str(attrs.get("utterance") or "")
    result = answer_faq(BookingStore(), tenant_id=tenant_id, utterance=utterance)

    if event.get("sessionState") is not None or event.get("bot") is not None:
        session = dict((event.get("sessionState") or {}).get("sessionAttributes") or {})
        session.update({k: str(v) for k, v in result.items()})
        return {
            "sessionState": {
                "sessionAttributes": session,
                "dialogAction": {"type": "Close"},
                "intent": {
                    "name": ((event.get("sessionState") or {}).get("intent") or {}).get(
                        "name"
                    )
                    or "AskFaq",
                    "state": "Fulfilled",
                },
            },
            "messages": [
                {"contentType": "PlainText", "content": result.get("answer") or ""}
            ],
        }

    return {k: ("" if v is None else str(v)) for k, v in result.items()}
