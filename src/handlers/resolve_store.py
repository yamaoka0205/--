"""Lambda handler: resolve the store at the start of a Connect call.

Invoked from the shared contact flow ("AWS Lambda function" block,
response validation STRING_MAP). Returns flat string values so the flow can
store them as contact attributes and read the store name in the greeting.

Output keys:
  found               "true" / "false"
  tenantId, storeName, inboundId, callerNumber
  inboundIsDemo       "true" when the call had no dialed number (WebRTC)
  callerNumberIsDemo  "true" when the caller number is the demo placeholder;
                      it must not be saved as the customer's phone number
  transferPhoneNumber empty when unset
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

_SRC = Path(__file__).resolve().parents[1]
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from booking.db import BookingStore
from booking.inbound import endpoints_from_contact


def _flag(value: bool) -> str:
    return "true" if value else "false"


def handler(event: dict[str, Any] | None = None, context: Any = None) -> dict[str, str]:
    contact_data = ((event or {}).get("Details") or {}).get("ContactData") or {}
    endpoints = endpoints_from_contact(contact_data)

    result = {
        "found": "false",
        "tenantId": "",
        "storeName": "",
        "inboundId": endpoints.inbound_id,
        "callerNumber": endpoints.caller_number,
        "inboundIsDemo": _flag(endpoints.inbound_is_demo),
        "callerNumberIsDemo": _flag(endpoints.caller_is_demo),
        "transferPhoneNumber": "",
    }

    store = BookingStore()
    inbound = store.get_inbound(endpoints.inbound_id)
    if not inbound:
        return result

    profile = store.get_profile(inbound["tenantId"])
    if not profile or profile.get("status") != "active":
        return result

    result.update(
        {
            "found": "true",
            "tenantId": profile["tenantId"],
            "storeName": profile.get("name", ""),
            "transferPhoneNumber": profile.get("transferPhoneNumber", ""),
        }
    )
    return result
