#!/usr/bin/env python3
"""Create or update the BookingApp-Inbound Connect contact flow."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

ROOT = Path(__file__).resolve().parents[1]
FLOW_PATH = ROOT / "infra" / "connect" / "BookingApp-Inbound.flow.json"
LEX_META = ROOT / "build" / "lex_bot.json"
FLOW_NAME = "BookingApp-Inbound"
INSTANCE_ID = os.environ.get(
    "CONNECT_INSTANCE_ID", "98c809c0-0dd7-414f-979a-bf7816f5bfae"
)
PLACEHOLDER_LAMBDA = (
    "arn:aws:lambda:${AWS_DEFAULT_REGION}:${AWS_ACCOUNT_ID}:function:BookingAppResolveStore"
)
PLACEHOLDER_LEX = (
    "arn:aws:lex:${AWS_DEFAULT_REGION}:${AWS_ACCOUNT_ID}:bot-alias/"
    "${LEX_BOT_ID}/${LEX_ALIAS_ID}"
)


def main() -> int:
    region = os.environ.get("AWS_DEFAULT_REGION") or os.environ.get("AWS_REGION")
    if not region:
        print("ERROR: set AWS_DEFAULT_REGION", file=sys.stderr)
        return 1

    # Refresh template with current placeholders
    from build_connect_flow import main as build_template

    build_template()

    session = boto3.Session(region_name=region)
    sts = session.client("sts")
    lam = session.client("lambda")
    connect = session.client("connect")
    account = sts.get_caller_identity()["Account"]
    fn_arn = lam.get_function(FunctionName="BookingAppResolveStore")[
        "Configuration"
    ]["FunctionArn"]

    if not LEX_META.exists():
        print(
            f"ERROR: {LEX_META} missing. Run scripts/deploy_lex_bot.py first.",
            file=sys.stderr,
        )
        return 1
    lex = json.loads(LEX_META.read_text())
    lex_arn = lex["aliasArn"]

    try:
        connect.associate_lambda_function(InstanceId=INSTANCE_ID, FunctionArn=fn_arn)
        print(f"Associated {fn_arn}")
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "ResourceConflictException":
            raise
        print("Lambda already associated")

    # Associate Lex with Connect if needed
    try:
        connect.associate_bot(InstanceId=INSTANCE_ID, LexV2Bot={"AliasArn": lex_arn})
        print("Associated Lex bot")
    except ClientError as exc:
        print(f"associate_bot: {exc.response['Error']['Code']}")

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
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "ResourceConflictException":
            raise

    raw = FLOW_PATH.read_text()
    raw = raw.replace(PLACEHOLDER_LAMBDA, fn_arn).replace(PLACEHOLDER_LEX, lex_arn)
    if "${" in raw:
        print("ERROR: unresolved placeholders remain", file=sys.stderr)
        return 1
    content = json.loads(raw)
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
            Description="BookingApp inbound: resolve store, DTMF, Lex reserve/FAQ",
            Content=body,
        )
        flow_id = resp["ContactFlowId"]
        print(f"Created {FLOW_NAME} ({flow_id})")

    desc = connect.describe_contact_flow(InstanceId=INSTANCE_ID, ContactFlowId=flow_id)
    cf = desc["ContactFlow"]
    print(f"State={cf.get('State')} Status={cf.get('Status')}")
    print(f"Arn={cf['Arn']}")
    print(f"LexAlias={lex_arn}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
