#!/usr/bin/env python3
"""Invoke resolve_store with a Connect-shaped event.

Examples:
  # WebRTC (no numbers) -> demo defaults
  python3 scripts/invoke_resolve_store.py

  # Real phone call
  python3 scripts/invoke_resolve_store.py --system +81312345678 --customer +819012345678
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from handlers.resolve_store import handler  # noqa: E402


def endpoint(address: str | None) -> dict | None:
    if not address:
        return None
    return {"Address": address, "Type": "TELEPHONE_NUMBER"}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--system", help="dialed Connect number (omit for WebRTC)")
    parser.add_argument("--customer", help="caller number (omit for WebRTC)")
    args = parser.parse_args()

    contact_data = {"Channel": "VOICE"}
    if args.system:
        contact_data["SystemEndpoint"] = endpoint(args.system)
    if args.customer:
        contact_data["CustomerEndpoint"] = endpoint(args.customer)

    event = {"Name": "ContactFlowEvent", "Details": {"ContactData": contact_data, "Parameters": {}}}
    print(json.dumps(handler(event, None), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
