"""Admin auth via Amazon Cognito Access Token + DynamoDB MEMBERSHIP.

Login itself can be done in the browser (InitiateAuth) or via /auth/login.
API handlers validate Authorization: Bearer <AccessToken> with Cognito GetUser,
then resolve tenantId from MEMBERSHIP.
"""

from __future__ import annotations

import os
from typing import Any

import boto3
from botocore.exceptions import ClientError

from booking.db import BookingStore

DEMO_EMAIL = os.environ.get("DEMO_ADMIN_EMAIL", "demo@sakura.local")
DEFAULT_TENANT_ID = "t_demo_001"


def _cognito():
    kwargs: dict[str, Any] = {}
    region = os.environ.get("AWS_DEFAULT_REGION") or os.environ.get("AWS_REGION")
    if region:
        kwargs["region_name"] = region
    return boto3.client("cognito-idp", **kwargs)


def cognito_config() -> dict[str, str]:
    return {
        "userPoolId": os.environ.get("COGNITO_USER_POOL_ID", ""),
        "clientId": os.environ.get("COGNITO_CLIENT_ID", ""),
        "region": os.environ.get("AWS_DEFAULT_REGION")
        or os.environ.get("AWS_REGION")
        or "",
    }


def list_memberships(store: BookingStore, user_id: str) -> list[dict]:
    from boto3.dynamodb.conditions import Key

    items: list[dict] = []
    kwargs = {
        "KeyConditionExpression": Key("PK").eq(f"USER#{user_id}")
        & Key("SK").begins_with("MEMBERSHIP#")
    }
    while True:
        resp = store.table.query(**kwargs)
        items.extend(resp.get("Items", []))
        last = resp.get("LastEvaluatedKey")
        if not last:
            break
        kwargs["ExclusiveStartKey"] = last
    return items


def active_membership(store: BookingStore, user_id: str) -> dict | None:
    memberships = [
        m
        for m in list_memberships(store, user_id)
        if m.get("status", "active") == "active"
    ]
    return memberships[0] if memberships else None


def get_user_from_access_token(access_token: str) -> dict[str, Any]:
    """Validate Cognito access token and return {sub, email, username, name}."""
    resp = _cognito().get_user(AccessToken=access_token)
    attrs = {a["Name"]: a["Value"] for a in resp.get("UserAttributes", [])}
    return {
        "username": resp.get("Username", ""),
        "sub": attrs.get("sub") or resp.get("Username", ""),
        "email": attrs.get("email", ""),
        "name": attrs.get("name", ""),
    }


def login_with_password(*, email: str, password: str) -> dict[str, Any]:
    cfg = cognito_config()
    if not cfg["clientId"]:
        return {"status": "error", "reason": "cognito_not_configured"}

    email_n = (email or "").strip().lower()
    if not email_n or not password:
        return {"status": "invalid_request", "reason": "missing_credentials"}

    try:
        resp = _cognito().initiate_auth(
            ClientId=cfg["clientId"],
            AuthFlow="USER_PASSWORD_AUTH",
            AuthParameters={"USERNAME": email_n, "PASSWORD": password},
        )
    except ClientError as exc:
        code = exc.response["Error"]["Code"]
        if code in {
            "NotAuthorizedException",
            "UserNotFoundException",
            "InvalidParameterException",
        }:
            return {"status": "unauthorized", "reason": "invalid_credentials"}
        return {"status": "error", "reason": code}

    if resp.get("ChallengeName"):
        return {
            "status": "challenge",
            "reason": resp["ChallengeName"],
            "session": resp.get("Session"),
        }

    result = resp.get("AuthenticationResult") or {}
    access = result.get("AccessToken")
    if not access:
        return {"status": "unauthorized", "reason": "no_access_token"}

    try:
        user = get_user_from_access_token(access)
    except ClientError as exc:
        return {"status": "unauthorized", "reason": exc.response["Error"]["Code"]}

    store = BookingStore()
    membership = active_membership(store, user["sub"])
    if not membership:
        return {"status": "forbidden", "reason": "no_membership"}

    tenant_id = str(membership.get("tenantId") or DEFAULT_TENANT_ID)
    profile = store.get_profile(tenant_id) or {}
    display = (
        str(membership.get("displayName") or "")
        or user.get("name")
        or email_n.split("@")[0]
    )
    return {
        "status": "ok",
        "accessToken": access,
        "idToken": result.get("IdToken"),
        "refreshToken": result.get("RefreshToken"),
        "expiresIn": result.get("ExpiresIn"),
        "tokenType": result.get("TokenType", "Bearer"),
        "userId": user["sub"],
        "tenantId": tenant_id,
        "displayName": display,
        "email": user.get("email") or email_n,
        "role": str(membership.get("role") or "tenant_admin"),
        "storeName": profile.get("name", ""),
    }


def logout_access_token(access_token: str) -> dict[str, Any]:
    if not access_token:
        return {"status": "ok"}
    try:
        _cognito().global_sign_out(AccessToken=access_token)
    except ClientError:
        # Token already invalid / expired → still treat as logged out
        pass
    return {"status": "ok"}


def session_from_access_token(
    store: BookingStore, access_token: str
) -> dict[str, Any] | None:
    try:
        user = get_user_from_access_token(access_token)
    except ClientError:
        return None
    membership = active_membership(store, user["sub"])
    if not membership:
        return None
    tenant_id = str(membership.get("tenantId") or "")
    profile = store.get_profile(tenant_id) or {}
    return {
        "userId": user["sub"],
        "tenantId": tenant_id,
        "displayName": str(
            membership.get("displayName") or user.get("name") or user.get("email") or ""
        ),
        "email": user.get("email") or "",
        "role": str(membership.get("role") or "tenant_admin"),
        "storeName": profile.get("name", ""),
    }


def session_payload(session: dict) -> dict[str, Any]:
    return {
        "status": "ok",
        "userId": session.get("userId"),
        "tenantId": session.get("tenantId"),
        "displayName": session.get("displayName"),
        "email": session.get("email"),
        "role": session.get("role"),
        "storeName": session.get("storeName"),
    }


def bearer_token(event: dict[str, Any] | None) -> str | None:
    if not event:
        return None
    headers = event.get("headers") or {}
    raw = headers.get("authorization") or headers.get("Authorization") or ""
    if isinstance(raw, str) and raw.lower().startswith("bearer "):
        return raw[7:].strip()
    return None


def require_session(store: BookingStore, event: dict[str, Any] | None) -> dict[str, Any]:
    token = bearer_token(event)
    if not token:
        return {
            "ok": False,
            "status_code": 401,
            "body": {"status": "unauthorized", "reason": "missing_token"},
        }
    session = session_from_access_token(store, token)
    if not session:
        return {
            "ok": False,
            "status_code": 401,
            "body": {"status": "unauthorized", "reason": "invalid_or_expired_session"},
        }
    return {"ok": True, "session": session, "token": token}
