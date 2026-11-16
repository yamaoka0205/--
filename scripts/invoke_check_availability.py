#!/usr/bin/env python3
"""Invoke check_availability against real AWS (or DynamoDB Local).

Examples:
  python3 scripts/invoke_check_availability.py \\
    --tenant-id t_demo_001 --date 2026-11-17 --start-time 19:00 --party-size 4

  python3 scripts/invoke_check_availability.py \\
    --tenant-id t_demo_001 --date 2026-11-15 --start-time 19:00 --party-size 4
  # Sunday seed = closed
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from handlers.check_availability import handler  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tenant-id", required=True)
    parser.add_argument("--date", required=True, help="yyyy-mm-dd")
    parser.add_argument("--start-time", required=True, help="HH:MM")
    parser.add_argument("--party-size", type=int, required=True)
    args = parser.parse_args()

    event = {
        "tenantId": args.tenant_id,
        "date": args.date,
        "startTime": args.start_time,
        "partySize": args.party_size,
    }
    result = handler(event, None)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    body = json.loads(result["body"])
    print("---")
    print(json.dumps(body, ensure_ascii=False, indent=2))
    return 0 if result["statusCode"] < 500 else 1


if __name__ == "__main__":
    raise SystemExit(main())
