#!/usr/bin/env python3
"""Confirm a reservation against real AWS / DynamoDB Local."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from handlers.confirm_reservation import handler  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tenant-id", required=True)
    parser.add_argument("--date", required=True)
    parser.add_argument("--start-time", required=True)
    parser.add_argument("--party-size", type=int, required=True)
    parser.add_argument("--customer-name", required=True)
    parser.add_argument("--customer-phone", default=None)
    parser.add_argument("--source", default="manual")
    parser.add_argument("--table-id", default=None)
    args = parser.parse_args()

    event = {
        "tenantId": args.tenant_id,
        "date": args.date,
        "startTime": args.start_time,
        "partySize": args.party_size,
        "customerName": args.customer_name,
        "source": args.source,
    }
    if args.customer_phone:
        event["customerPhone"] = args.customer_phone
    if args.table_id:
        event["tableId"] = args.table_id

    result = handler(event, None)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print("---")
    print(json.dumps(json.loads(result["body"]), ensure_ascii=False, indent=2))
    return 0 if result["statusCode"] < 500 else 1


if __name__ == "__main__":
    raise SystemExit(main())
