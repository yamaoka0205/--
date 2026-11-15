#!/usr/bin/env python3
"""Deploy Booking API to AWS Lambda + API Gateway HTTP API.

Requires IAM permissions beyond DynamoDB (Lambda, API Gateway, IAM role, logs).

Usage:
  python3 scripts/deploy_api.py
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

ROOT = Path(__file__).resolve().parents[1]
ROLE_NAME = "BookingAppLambdaRole"
POLICY_NAME = "BookingAppLambdaPolicy"
API_NAME = "BookingAppApi"
FUNCTIONS = {
    "BookingAppCheckAvailability": {
        "handler": "handlers.check_availability.handler",
        "route": "POST /availability/check",
    },
    "BookingAppConfirmReservation": {
        "handler": "handlers.confirm_reservation.handler",
        "route": "POST /reservations/confirm",
    },
}


def region() -> str:
    value = os.environ.get("AWS_DEFAULT_REGION") or os.environ.get("AWS_REGION")
    if not value:
        print("ERROR: set AWS_DEFAULT_REGION", file=sys.stderr)
        raise SystemExit(1)
    return value


def account_id(sts) -> str:
    return sts.get_caller_identity()["Account"]


def package_zip() -> Path:
    script = ROOT / "scripts" / "package_lambda.sh"
    out = subprocess.check_output(["bash", str(script)], text=True).strip()
    path = Path(out)
    if not path.exists():
        raise RuntimeError(f"zip not found: {path}")
    print(f"Packaged {path} ({path.stat().st_size} bytes)")
    return path


def ensure_role(iam, account: str, reg: str) -> str:
    role_arn = f"arn:aws:iam::{account}:role/{ROLE_NAME}"
    trust = (ROOT / "infra" / "lambda_trust_policy.json").read_text()
    policy_doc = (ROOT / "infra" / "lambda_dynamodb_policy.json").read_text()
    try:
        iam.create_role(
            RoleName=ROLE_NAME,
            AssumeRolePolicyDocument=trust,
            Description="Execution role for BookingApp Lambda functions",
        )
        print(f"Created role {ROLE_NAME}")
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "EntityAlreadyExists":
            raise
        print(f"Role exists {ROLE_NAME}")

    try:
        iam.put_role_policy(
            RoleName=ROLE_NAME,
            PolicyName=POLICY_NAME,
            PolicyDocument=policy_doc,
        )
    except ClientError:
        raise

    # IAM role propagation can lag briefly.
    time.sleep(8)
    return role_arn


def ensure_function(lam, name: str, handler: str, role_arn: str, zip_path: Path, reg: str):
    env = {"Variables": {"BOOKING_TABLE_NAME": "BookingApp"}}
    zip_bytes = zip_path.read_bytes()
    try:
        lam.get_function(FunctionName=name)
        exists = True
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "ResourceNotFoundException":
            raise
        exists = False

    if not exists:
        print(f"Creating function {name}")
        lam.create_function(
            FunctionName=name,
            Runtime="python3.12",
            Role=role_arn,
            Handler=handler,
            Code={"ZipFile": zip_bytes},
            Timeout=15,
            MemorySize=256,
            Environment=env,
            Description="BookingApp API",
        )
        waiter = lam.get_waiter("function_active_v2")
        waiter.wait(FunctionName=name)
    else:
        print(f"Updating function code {name}")
        lam.update_function_code(FunctionName=name, ZipFile=zip_bytes)
        waiter = lam.get_waiter("function_updated_v2")
        waiter.wait(FunctionName=name)
        lam.update_function_configuration(
            FunctionName=name,
            Handler=handler,
            Runtime="python3.12",
            Timeout=15,
            MemorySize=256,
            Environment=env,
            Role=role_arn,
        )
        waiter.wait(FunctionName=name)

    return lam.get_function(FunctionName=name)["Configuration"]["FunctionArn"]


def ensure_http_api(apigw, lam, account: str, reg: str) -> str:
    apis = apigw.get_apis().get("Items", [])
    api_id = None
    for api in apis:
        if api.get("Name") == API_NAME:
            api_id = api["ApiId"]
            break
    if not api_id:
        print(f"Creating HTTP API {API_NAME}")
        api_id = apigw.create_api(
            Name=API_NAME,
            ProtocolType="HTTP",
            CorsConfiguration={
                "AllowHeaders": ["content-type"],
                "AllowMethods": ["POST", "OPTIONS"],
                "AllowOrigins": ["*"],
            },
        )["ApiId"]
    else:
        print(f"HTTP API exists {api_id}")

    # Stage
    try:
        apigw.create_stage(ApiId=api_id, StageName="prod", AutoDeploy=True)
    except ClientError as exc:
        if exc.response["Error"]["Code"] not in {
            "ConflictException",
            "BadRequestException",
        }:
            # already exists is fine
            msg = exc.response["Error"].get("Message", "")
            if "already exists" not in msg.lower():
                # try get
                try:
                    apigw.get_stage(ApiId=api_id, StageName="prod")
                except ClientError:
                    raise exc

    for fn_name, meta in FUNCTIONS.items():
        method, path = meta["route"].split(" ", 1)
        integration_uri = (
            f"arn:aws:apigateway:{reg}:lambda:path/2015-03-31/functions/"
            f"arn:aws:lambda:{reg}:{account}:function:{fn_name}/invocations"
        )

        # Find or create integration
        integrations = apigw.get_integrations(ApiId=api_id).get("Items", [])
        integration_id = None
        for integ in integrations:
            if integ.get("IntegrationUri") == integration_uri:
                integration_id = integ["IntegrationId"]
                break
        if not integration_id:
            integration_id = apigw.create_integration(
                ApiId=api_id,
                IntegrationType="AWS_PROXY",
                IntegrationUri=integration_uri,
                PayloadFormatVersion="2.0",
                IntegrationMethod="POST",
            )["IntegrationId"]
            print(f"Created integration for {fn_name}")

        # Route
        routes = apigw.get_routes(ApiId=api_id).get("Items", [])
        route_key = f"{method} {path}"
        route_id = None
        for route in routes:
            if route.get("RouteKey") == route_key:
                route_id = route["RouteId"]
                break
        if not route_id:
            apigw.create_route(
                ApiId=api_id,
                RouteKey=route_key,
                Target=f"integrations/{integration_id}",
            )
            print(f"Created route {route_key}")
        else:
            apigw.update_route(
                ApiId=api_id,
                RouteId=route_id,
                Target=f"integrations/{integration_id}",
            )
            print(f"Updated route {route_key}")

        # Permission for API Gateway to invoke Lambda
        statement_id = f"apigw-{api_id}-{fn_name}".replace("_", "")[:100]
        source_arn = f"arn:aws:execute-api:{reg}:{account}:{api_id}/*/*{path}"
        try:
            lam.add_permission(
                FunctionName=fn_name,
                StatementId=statement_id,
                Action="lambda:InvokeFunction",
                Principal="apigateway.amazonaws.com",
                SourceArn=source_arn,
            )
            print(f"Added invoke permission for {fn_name}")
        except ClientError as exc:
            if exc.response["Error"]["Code"] != "ResourceConflictException":
                raise
            print(f"Invoke permission exists for {fn_name}")

    return f"https://{api_id}.execute-api.{reg}.amazonaws.com/prod"


def main() -> int:
    reg = region()
    session = boto3.Session(region_name=reg)
    sts = session.client("sts")
    iam = session.client("iam")
    lam = session.client("lambda")
    apigw = session.client("apigatewayv2")
    account = account_id(sts)
    print(f"Account={account} Region={reg}")

    zip_path = package_zip()
    role_arn = ensure_role(iam, account, reg)

    for fn_name, meta in FUNCTIONS.items():
        ensure_function(lam, fn_name, meta["handler"], role_arn, zip_path, reg)

    base_url = ensure_http_api(apigw, lam, account, reg)
    print("OK")
    print(f"Base URL: {base_url}")
    print(f"  POST {base_url}/availability/check")
    print(f"  POST {base_url}/reservations/confirm")

    out = ROOT / "build" / "api_endpoints.json"
    out.write_text(
        json.dumps(
            {
                "baseUrl": base_url,
                "checkAvailability": f"{base_url}/availability/check",
                "confirmReservation": f"{base_url}/reservations/confirm",
            },
            indent=2,
        )
        + "\n"
    )
    print(f"Wrote {out}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ClientError as exc:
        code = exc.response["Error"]["Code"]
        msg = exc.response["Error"]["Message"]
        print(f"ERROR [{code}]: {msg}", file=sys.stderr)
        if code in {"AccessDenied", "AccessDeniedException", "UnauthorizedOperation"}:
            print(
                "IAMユーザー cursor に Lambda / API Gateway / IAM Role 作成権限を追加してください。",
                file=sys.stderr,
            )
        raise SystemExit(1)
