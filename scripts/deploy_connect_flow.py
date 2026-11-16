#!/usr/bin/env python3
"""Create or update the BookingApp-Inbound Connect contact flow.

Reads infra/connect/BookingApp-Inbound.flow.json (ARN placeholders) and
substitutes the live BookingAppResolveStore ARN for this account/region.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import boto3

ROOT = Path(__file__).resolve().parents[1]
FLOW_PATH = ROOT / "infra" / "connect" / "BookingApp-Inbound.flow.json"
FLOW_NAME = "BookingApp-Inbound"
INSTANCE_ID = os.environ.get(
    "CONNECT_INSTANCE_ID", "98c809c0-0dd7-414f-979a-bf7816f5bfae"
)
PLACEHOLDER = (
    "arn:aws:lambda:${AWS_DEFAULT_REGION}:${AWS_ACCOUNT_ID}:function:BookingAppResolveStore"
)


def main() -> int:
    region = os.environ.get("AWS_DEFAULT_REGION") or os.environ.get("AWS_REGION")
    if not region:
        print("ERROR: set AWS_DEFAULT_REGION", file=sys.stderr)
        return 1

    session = boto3.Session(region_name=region)
    sts = session.client("sts")
    lam = session.client("lambda")
    connect = session.client("connect")
    account = sts.get_caller_identity()["Account"]
    fn_arn = lam.get_function(FunctionName="BookingAppResolveStore")[
        "Configuration"
    ]["FunctionArn"]

    try:
        connect.associate_lambda_function(InstanceId=INSTANCE_ID, FunctionArn=fn_arn)
        print(f"Associated {fn_arn}")
    except connect.exceptions.ResourceConflictException:
        print("Lambda already associated")

    instance_arn = f"arn:aws:connect:{region}:{account}:instance/{INSTANCE_ID}"
    try:
        lam.add_permission(
            FunctionName="BookingAppResolveStore",
            StatementId="AmazonConnectBookingAppResolveStore",
            Action="lambda:InvokeFunction",
            Principal="connect.amazonaws.com",
            SourceAccount=account,
            SourceArn=instance_arn,
        )
        print("Added Lambda invoke permission for Connect")
    except lam.exceptions.ResourceConflictException:
        print("Lambda invoke permission exists")

    raw = FLOW_PATH.read_text()
    if PLACEHOLDER not in raw:
        print(f"ERROR: expected placeholder ARN in {FLOW_PATH}", file=sys.stderr)
        return 1
    content = json.loads(raw.replace(PLACEHOLDER, fn_arn))
    body = json.dumps(content)

    existing = connect.list_contact_flows(InstanceId=INSTANCE_ID).get(
        "ContactFlowSummaryList", []
    )
    match = next((f for f in existing if f["Name"] == FLOW_NAME), None)
    if match:
        connect.update_contact_flow_content(
            InstanceId=INSTANCE_ID, ContactFlowId=match["Id"], Content=body
        )
        flow_id = match["Id"]
        print(f"Updated {FLOW_NAME} ({flow_id})")
    else:
        resp = connect.create_contact_flow(
            InstanceId=INSTANCE_ID,
            Name=FLOW_NAME,
            Type="CONTACT_FLOW",
            Description=(
                "BookingApp shared inbound flow: resolve store, greet, "
                "DTMF 1=reservation 2=inquiry"
            ),
            Content=body,
        )
        flow_id = resp["ContactFlowId"]
        print(f"Created {FLOW_NAME} ({flow_id})")

    desc = connect.describe_contact_flow(InstanceId=INSTANCE_ID, ContactFlowId=flow_id)
    cf = desc["ContactFlow"]
    print(f"State={cf.get('State')} Status={cf.get('Status')}")
    print(f"Arn={cf['Arn']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
