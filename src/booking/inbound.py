"""Resolve which store a Connect call is for, and what kind of call it is.

Three call types:
  phone            normal phone call: dialed number + caller number
  phone_anonymous  phone call with caller ID withheld; Connect sends the
                   caller address as the literal string "anonymous"
  webrtc           browser call (InitiationMethod WEBRTC_API /
                   connect:Subtype connect:WebRTC); carries no phone numbers

Missing numbers on WebRTC are filled with demo defaults. The defaults are
invalid Japanese numbers (+81 followed by 0) so they can never belong to a
real person. A withheld caller is left empty: inventing a number there would
hide the fact that the caller chose not to share it.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

DEFAULT_DEMO_INBOUND_NUMBER = "+810000000001"
DEFAULT_DEMO_CALLER_NUMBER = "+810000000000"

CALL_PHONE = "phone"
CALL_PHONE_ANONYMOUS = "phone_anonymous"
CALL_WEBRTC = "webrtc"


def demo_inbound_number() -> str:
    return os.environ.get("DEMO_INBOUND_NUMBER", DEFAULT_DEMO_INBOUND_NUMBER)


def demo_caller_number() -> str:
    return os.environ.get("DEMO_CALLER_NUMBER", DEFAULT_DEMO_CALLER_NUMBER)


@dataclass(frozen=True)
class CallEndpoints:
    call_type: str
    inbound_id: str
    caller_number: str
    inbound_is_demo: bool
    caller_is_demo: bool

    @property
    def caller_number_available(self) -> bool:
        """True only for a real caller number that may be saved."""
        return bool(self.caller_number) and not self.caller_is_demo


def _address(endpoint: Any) -> str:
    if not isinstance(endpoint, dict):
        return ""
    if endpoint.get("Type") not in (None, "TELEPHONE_NUMBER"):
        return ""
    return (endpoint.get("Address") or "").strip()


def _segment_subtype(contact_data: dict[str, Any]) -> str:
    subtype = (contact_data.get("SegmentAttributes") or {}).get("connect:Subtype")
    if isinstance(subtype, dict):
        return subtype.get("ValueString", "")
    return subtype or ""


def is_webrtc(contact_data: dict[str, Any]) -> bool:
    if contact_data.get("InitiationMethod") == "WEBRTC_API":
        return True
    return _segment_subtype(contact_data) == "connect:WebRTC"


def _is_withheld(caller: str) -> bool:
    return not caller or caller.lower() == "anonymous" or not caller.startswith("+")


def endpoints_from_contact(contact_data: dict[str, Any] | None) -> CallEndpoints:
    contact_data = contact_data or {}
    inbound = _address(contact_data.get("SystemEndpoint"))
    caller = _address(contact_data.get("CustomerEndpoint"))

    if is_webrtc(contact_data):
        return CallEndpoints(
            call_type=CALL_WEBRTC,
            inbound_id=inbound or demo_inbound_number(),
            caller_number=caller if not _is_withheld(caller) else demo_caller_number(),
            inbound_is_demo=not inbound,
            caller_is_demo=_is_withheld(caller),
        )

    if _is_withheld(caller):
        return CallEndpoints(
            call_type=CALL_PHONE_ANONYMOUS,
            inbound_id=inbound,
            caller_number="",
            inbound_is_demo=False,
            caller_is_demo=False,
        )

    return CallEndpoints(
        call_type=CALL_PHONE,
        inbound_id=inbound,
        caller_number=caller,
        inbound_is_demo=False,
        caller_is_demo=False,
    )
