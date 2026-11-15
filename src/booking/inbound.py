"""Resolve which store a Connect call is for.

Real phone calls carry the dialed Connect number (SystemEndpoint) and the
caller's number (CustomerEndpoint). WebRTC calls carry neither, so demo
defaults fill the gaps. The defaults are deliberately invalid Japanese
numbers (+81 followed by 0) so they can never belong to a real person.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

DEFAULT_DEMO_INBOUND_NUMBER = "+810000000001"
DEFAULT_DEMO_CALLER_NUMBER = "+810000000000"


def demo_inbound_number() -> str:
    return os.environ.get("DEMO_INBOUND_NUMBER", DEFAULT_DEMO_INBOUND_NUMBER)


def demo_caller_number() -> str:
    return os.environ.get("DEMO_CALLER_NUMBER", DEFAULT_DEMO_CALLER_NUMBER)


@dataclass(frozen=True)
class CallEndpoints:
    inbound_id: str
    caller_number: str
    inbound_is_demo: bool
    caller_is_demo: bool


def _address(endpoint: Any) -> str:
    if not isinstance(endpoint, dict):
        return ""
    if endpoint.get("Type") not in (None, "TELEPHONE_NUMBER"):
        return ""
    return (endpoint.get("Address") or "").strip()


def endpoints_from_contact(contact_data: dict[str, Any] | None) -> CallEndpoints:
    contact_data = contact_data or {}
    inbound = _address(contact_data.get("SystemEndpoint"))
    caller = _address(contact_data.get("CustomerEndpoint"))
    return CallEndpoints(
        inbound_id=inbound or demo_inbound_number(),
        caller_number=caller or demo_caller_number(),
        inbound_is_demo=not inbound,
        caller_is_demo=not caller,
    )
