#!/usr/bin/env python3
"""Invoke resolve_store with a Connect-shaped event.

Examples:
  # WebRTC
  python3 scripts/invoke_resolve_store.py --webrtc

  # Normal phone call
  python3 scripts/invoke_resolve_store.py --system +810000000001 --customer +819012345678

  # Caller ID withheld (Connect sends "anonymous")
  python3 scripts/invoke_resolve_store.py --system +810000000001 --customer anonymous
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from handlers.resolve_store import handler  # noqa: E402


def build_event(system: str | None, customer: str | None, webrtc: bool) -> dict:
    contact_data: dict = {"Channel": "VOICE"}
    if webrtc:
        contact_data["InitiationMethod"] = "WEBRTC_API"
        contact_data["SegmentAttributes"] = {
            "connect:Subtype": {"ValueString": "connect:WebRTC"}
        }
    else:
        contact_data["InitiationMethod"] = "INBOUND"
        contact_data["SegmentAttributes"] = {
            "connect:Subtype": {"ValueString": "connect:Telephony"}
        }
    if system:
        contact_data["SystemEndpoint"] = {"Address": system, "Type": "TELEPHONE_NUMBER"}
    if customer:
        contact_data["CustomerEndpoint"] = {"Address": customer, "Type": "TELEPHONE_NUMBER"}
    return {"Name": "ContactFlowEvent", "Details": {"ContactData": contact_data, "Parameters": {}}}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--system", help="dialed Connect number")
    parser.add_argument("--customer", help='caller number, or "anonymous"')
    parser.add_argument("--webrtc", action="store_true")
    args = parser.parse_args()

    event = build_event(args.system, args.customer, args.webrtc)
    print(json.dumps(handler(event, None), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
