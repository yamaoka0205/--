#!/usr/bin/env python3
"""Create the BookingApp DynamoDB table (PK/SK + GSI1 + TTL).

Usage:
  # DynamoDB Local
  python3 scripts/create_table.py --endpoint-url http://localhost:8000

  # AWS (uses default credential/region chain)
  python3 scripts/create_table.py --region ap-northeast-1
"""

from __future__ import annotations

import argparse
import sys

import boto3
from botocore.exceptions import ClientError


TABLE_NAME = "BookingApp"
GSI1_NAME = "GSI1"
TTL_ATTRIBUTE = "expiresAt"


def build_client(endpoint_url: str | None, region: str):
    kwargs = {"region_name": region}
    if endpoint_url:
        kwargs["endpoint_url"] = endpoint_url
        # DynamoDB Local accepts any credentials.
        kwargs["aws_access_key_id"] = "local"
        kwargs["aws_secret_access_key"] = "local"
    return boto3.client("dynamodb", **kwargs)


def table_exists(client, table_name: str) -> bool:
    try:
        client.describe_table(TableName=table_name)
        return True
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ResourceNotFoundException":
            return False
        raise


def create_table(client, table_name: str) -> None:
    client.create_table(
        TableName=table_name,
        BillingMode="PAY_PER_REQUEST",
        AttributeDefinitions=[
            {"AttributeName": "PK", "AttributeType": "S"},
            {"AttributeName": "SK", "AttributeType": "S"},
            {"AttributeName": "GSI1PK", "AttributeType": "S"},
            {"AttributeName": "GSI1SK", "AttributeType": "S"},
        ],
        KeySchema=[
            {"AttributeName": "PK", "KeyType": "HASH"},
            {"AttributeName": "SK", "KeyType": "RANGE"},
        ],
        GlobalSecondaryIndexes=[
            {
                "IndexName": GSI1_NAME,
                "KeySchema": [
                    {"AttributeName": "GSI1PK", "KeyType": "HASH"},
                    {"AttributeName": "GSI1SK", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            }
        ],
    )
    waiter = client.get_waiter("table_exists")
    waiter.wait(TableName=table_name)


def enable_ttl(client, table_name: str) -> None:
    # DynamoDB Local may ignore TTL; AWS enables background expiry cleanup.
    try:
        client.update_time_to_live(
            TableName=table_name,
            TimeToLiveSpecification={
                "Enabled": True,
                "AttributeName": TTL_ATTRIBUTE,
            },
        )
    except ClientError as exc:
        code = exc.response["Error"]["Code"]
        # Idempotent: already enabled with same attribute.
        if code in {"ValidationException", "ResourceInUseException"}:
            desc = client.describe_time_to_live(TableName=table_name)
            status = desc.get("TimeToLiveDescription", {})
            if (
                status.get("TimeToLiveStatus") in {"ENABLED", "ENABLING"}
                and status.get("AttributeName") == TTL_ATTRIBUTE
            ):
                return
        raise


def describe_summary(client, table_name: str) -> dict:
    table = client.describe_table(TableName=table_name)["Table"]
    ttl = client.describe_time_to_live(TableName=table_name).get(
        "TimeToLiveDescription", {}
    )
    gsis = [
        {
            "IndexName": gsi["IndexName"],
            "KeySchema": gsi["KeySchema"],
            "Projection": gsi.get("Projection", {}),
        }
        for gsi in table.get("GlobalSecondaryIndexes", [])
    ]
    return {
        "TableName": table["TableName"],
        "TableStatus": table["TableStatus"],
        "BillingMode": table.get("BillingModeSummary", {}).get(
            "BillingMode", table.get("BillingMode", "UNKNOWN")
        ),
        "KeySchema": table["KeySchema"],
        "AttributeDefinitions": table["AttributeDefinitions"],
        "GlobalSecondaryIndexes": gsis,
        "TimeToLive": {
            "AttributeName": ttl.get("AttributeName"),
            "Status": ttl.get("TimeToLiveStatus"),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Create BookingApp DynamoDB table")
    parser.add_argument(
        "--table-name",
        default=TABLE_NAME,
        help=f"Table name (default: {TABLE_NAME})",
    )
    parser.add_argument(
        "--endpoint-url",
        default=None,
        help="DynamoDB endpoint (e.g. http://localhost:8000 for Local)",
    )
    parser.add_argument(
        "--region",
        default="ap-northeast-1",
        help="AWS region (default: ap-northeast-1)",
    )
    args = parser.parse_args()

    client = build_client(args.endpoint_url, args.region)
    target = (
        f"endpoint={args.endpoint_url}"
        if args.endpoint_url
        else f"region={args.region}"
    )
    print(f"Target: {target}")
    print(f"Table:  {args.table_name}")

    if table_exists(client, args.table_name):
        print("Table already exists. Skipping create.")
    else:
        print("Creating table...")
        create_table(client, args.table_name)
        print("Table created.")

    print("Ensuring TTL...")
    enable_ttl(client, args.table_name)

    summary = describe_summary(client, args.table_name)
    print("OK")
    print(f"  status:   {summary['TableStatus']}")
    print(f"  billing:  {summary['BillingMode']}")
    print(f"  keys:     {summary['KeySchema']}")
    print(f"  gsi:      {[g['IndexName'] for g in summary['GlobalSecondaryIndexes']]}")
    print(
        f"  ttl:      {summary['TimeToLive']['AttributeName']}"
        f" ({summary['TimeToLive']['Status']})"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ClientError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
