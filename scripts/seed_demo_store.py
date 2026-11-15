#!/usr/bin/env python3
"""Seed one demo tenant into BookingApp.

Creates:
  - PROFILE + INBOUND# (same transaction, condition attribute_not_exists)
  - HOURS#mon..sun
  - TABLE# (AI予約枠: 4人用4卓 + 6人用2卓、当日客用: 4人用2卓)

Usage:
  python3 scripts/seed_demo_store.py
  TRANSFER_PHONE_NUMBER=+8190... python3 scripts/seed_demo_store.py
  python3 scripts/seed_demo_store.py --endpoint-url http://localhost:8000
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError


TABLE_NAME = "BookingApp"
TENANT_ID = "t_demo_001"
INBOUND_ID = "demo-sakura"
STORE_NAME = "デモ食堂さくら"
TIMEZONE = "Asia/Tokyo"
STANDARD_DURATION_MIN = 120
RESERVATION_SLOT_MIN = 15

# Demo hours: open 11:00-22:00, closed Sunday.
HOURS = {
    "mon": {"openTime": "11:00", "closeTime": "22:00", "isClosed": False},
    "tue": {"openTime": "11:00", "closeTime": "22:00", "isClosed": False},
    "wed": {"openTime": "11:00", "closeTime": "22:00", "isClosed": False},
    "thu": {"openTime": "11:00", "closeTime": "22:00", "isClosed": False},
    "fri": {"openTime": "11:00", "closeTime": "22:00", "isClosed": False},
    "sat": {"openTime": "11:00", "closeTime": "22:00", "isClosed": False},
    "sun": {"openTime": "11:00", "closeTime": "22:00", "isClosed": True},
}

# AI bookable first, then walk-in only.
TABLES = [
    {"tableId": "T4-01", "capacity": 4, "label": "4人用A", "aiBookable": True, "sortOrder": 1},
    {"tableId": "T4-02", "capacity": 4, "label": "4人用B", "aiBookable": True, "sortOrder": 2},
    {"tableId": "T4-03", "capacity": 4, "label": "4人用C", "aiBookable": True, "sortOrder": 3},
    {"tableId": "T4-04", "capacity": 4, "label": "4人用D", "aiBookable": True, "sortOrder": 4},
    {"tableId": "T6-01", "capacity": 6, "label": "6人用A", "aiBookable": True, "sortOrder": 5},
    {"tableId": "T6-02", "capacity": 6, "label": "6人用B", "aiBookable": True, "sortOrder": 6},
    {"tableId": "T4-05", "capacity": 4, "label": "4人用E（当日客用）", "aiBookable": False, "sortOrder": 7},
    {"tableId": "T4-06", "capacity": 4, "label": "4人用F（当日客用）", "aiBookable": False, "sortOrder": 8},
]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def last_start_time(close_time: str, duration_min: int) -> str:
    h, m = map(int, close_time.split(":"))
    total = h * 60 + m - duration_min
    if total < 0:
        raise ValueError(f"closeTime {close_time} is shorter than duration {duration_min}")
    return f"{total // 60:02d}:{total % 60:02d}"


def build_clients(endpoint_url: str | None, region: str):
    kwargs = {"region_name": region}
    if endpoint_url:
        kwargs["endpoint_url"] = endpoint_url
        kwargs["aws_access_key_id"] = "local"
        kwargs["aws_secret_access_key"] = "local"
    # Use low-level client for TransactWrite (resource.meta.client re-serializes).
    client = boto3.client("dynamodb", **kwargs)
    resource = boto3.resource("dynamodb", **kwargs)
    return client, resource


def _to_attr_map(item: dict) -> dict:
    """Convert plain Python types to DynamoDB AttributeValue map via TypeSerializer."""
    from boto3.dynamodb.types import TypeSerializer

    serializer = TypeSerializer()
    return {k: serializer.serialize(v) for k, v in item.items()}


def put_profile_and_inbound(client, table_name: str, transfer_phone: str | None, now: str) -> None:
    profile = {
        "PK": f"TENANT#{TENANT_ID}",
        "SK": "PROFILE",
        "entityType": "TENANT_PROFILE",
        "tenantId": TENANT_ID,
        "name": STORE_NAME,
        "status": "active",
        "inboundId": INBOUND_ID,
        "standardDurationMin": STANDARD_DURATION_MIN,
        "reservationSlotMin": RESERVATION_SLOT_MIN,
        "timezone": TIMEZONE,
        "createdAt": now,
        "updatedAt": now,
    }
    if transfer_phone:
        profile["transferPhoneNumber"] = transfer_phone

    inbound = {
        "PK": f"INBOUND#{INBOUND_ID}",
        "SK": "TENANT",
        "entityType": "INBOUND_LOOKUP",
        "inboundId": INBOUND_ID,
        "tenantId": TENANT_ID,
        "createdAt": now,
    }

    try:
        client.transact_write_items(
            TransactItems=[
                {
                    "Put": {
                        "TableName": table_name,
                        "Item": _to_attr_map(profile),
                        "ConditionExpression": "attribute_not_exists(PK)",
                    }
                },
                {
                    "Put": {
                        "TableName": table_name,
                        "Item": _to_attr_map(inbound),
                        "ConditionExpression": "attribute_not_exists(PK)",
                    }
                },
            ]
        )
        print(f"Created PROFILE + INBOUND for {TENANT_ID}")
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "TransactionCanceledException":
            raise
        reasons = exc.response.get("CancellationReasons", [])
        codes = [r.get("Code") for r in reasons]
        # Both items already present → idempotent skip.
        if codes and all(c == "ConditionalCheckFailed" for c in codes):
            print(f"PROFILE/INBOUND already exist for {TENANT_ID}; skipping")
            return
        print(f"ERROR: PROFILE/INBOUND transaction canceled: {reasons}", file=sys.stderr)
        raise


def put_hours(table, now: str) -> None:
    with table.batch_writer() as batch:
        for dow, hours in HOURS.items():
            item = {
                "PK": f"TENANT#{TENANT_ID}",
                "SK": f"HOURS#{dow}",
                "entityType": "BUSINESS_HOURS",
                "tenantId": TENANT_ID,
                "dow": dow,
                "openTime": hours["openTime"],
                "closeTime": hours["closeTime"],
                "isClosed": hours["isClosed"],
                "updatedAt": now,
            }
            if not hours["isClosed"]:
                item["lastStartTime"] = last_start_time(
                    hours["closeTime"], STANDARD_DURATION_MIN
                )
            batch.put_item(Item=item)
    print(f"Upserted HOURS ({len(HOURS)} days)")


def put_tables(table, now: str) -> None:
    with table.batch_writer() as batch:
        for t in TABLES:
            batch.put_item(
                Item={
                    "PK": f"TENANT#{TENANT_ID}",
                    "SK": f"TABLE#{t['tableId']}",
                    "entityType": "TABLE",
                    "tenantId": TENANT_ID,
                    "tableId": t["tableId"],
                    "capacity": t["capacity"],
                    "label": t["label"],
                    "aiBookable": t["aiBookable"],
                    "active": True,
                    "sortOrder": t["sortOrder"],
                    "updatedAt": now,
                }
            )
    ai = sum(1 for t in TABLES if t["aiBookable"])
    walk = len(TABLES) - ai
    print(f"Upserted TABLE ({ai} AI + {walk} walk-in)")


def summarize(table) -> None:
    from boto3.dynamodb.conditions import Key

    profile = table.get_item(Key={"PK": f"TENANT#{TENANT_ID}", "SK": "PROFILE"}).get(
        "Item"
    )
    inbound = table.get_item(
        Key={"PK": f"INBOUND#{INBOUND_ID}", "SK": "TENANT"}
    ).get("Item")
    hours = table.query(
        KeyConditionExpression=Key("PK").eq(f"TENANT#{TENANT_ID}")
        & Key("SK").begins_with("HOURS#")
    ).get("Items", [])
    tables = table.query(
        KeyConditionExpression=Key("PK").eq(f"TENANT#{TENANT_ID}")
        & Key("SK").begins_with("TABLE#")
    ).get("Items", [])

    print("OK")
    print(f"  tenantId:   {TENANT_ID}")
    print(f"  name:       {profile.get('name') if profile else None}")
    print(f"  inboundId:  {inbound.get('inboundId') if inbound else None}")
    print(
        f"  transfer:   {'set' if profile and profile.get('transferPhoneNumber') else 'unset'}"
    )
    print(f"  hours:      {len(hours)}")
    print(f"  tables:     {len(tables)}")
    print(
        f"  aiBookable: {sum(1 for t in tables if t.get('aiBookable'))}"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed demo store into BookingApp")
    parser.add_argument("--table-name", default=TABLE_NAME)
    parser.add_argument("--endpoint-url", default=None)
    parser.add_argument(
        "--region",
        default=None,
        help="AWS region (default: AWS_DEFAULT_REGION or AWS_REGION)",
    )
    parser.add_argument(
        "--transfer-phone",
        default=os.environ.get("TRANSFER_PHONE_NUMBER"),
        help="Optional E.164 transfer number (or set TRANSFER_PHONE_NUMBER)",
    )
    args = parser.parse_args()

    region = (
        args.region
        or os.environ.get("AWS_DEFAULT_REGION")
        or os.environ.get("AWS_REGION")
    )
    if not region and not args.endpoint_url:
        print(
            "ERROR: set --region or AWS_DEFAULT_REGION / AWS_REGION",
            file=sys.stderr,
        )
        return 1

    client, resource = build_clients(args.endpoint_url, region or "local")
    table = resource.Table(args.table_name)
    now = utc_now_iso()

    target = (
        f"endpoint={args.endpoint_url}"
        if args.endpoint_url
        else f"region={region}"
    )
    print(f"Target: {target}")
    print(f"Table:  {args.table_name}")

    put_profile_and_inbound(client, args.table_name, args.transfer_phone, now)
    put_hours(table, now)
    put_tables(table, now)
    summarize(table)
    if not args.transfer_phone:
        print(
            "Note: transferPhoneNumber unset. "
            "Re-run with TRANSFER_PHONE_NUMBER=+81... to add it."
        )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ClientError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
