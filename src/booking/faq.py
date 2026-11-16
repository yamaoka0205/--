"""Answer store FAQ questions from DynamoDB items (+ optional Bedrock)."""

from __future__ import annotations

import json
import os
import re
from typing import Any

from booking.db import BookingStore


def list_faqs(store: BookingStore, tenant_id: str) -> list[dict]:
    from boto3.dynamodb.conditions import Key

    items: list[dict] = []
    kwargs = {
        "KeyConditionExpression": Key("PK").eq(f"TENANT#{tenant_id}")
        & Key("SK").begins_with("FAQ#")
    }
    while True:
        resp = store.table.query(**kwargs)
        items.extend(resp.get("Items", []))
        last = resp.get("LastEvaluatedKey")
        if not last:
            break
        kwargs["ExclusiveStartKey"] = last
    return items


def _score(question: str, tags: list[str], utterance: str) -> int:
    text = utterance.lower()
    score = 0
    for token in re.findall(r"[一-龥ぁ-んァ-ヶーa-zA-Z0-9]+", question):
        if len(token) >= 2 and token.lower() in text:
            score += 2
    for tag in tags:
        if tag and str(tag).lower() in text:
            score += 3
    return score


def match_faq(faqs: list[dict], utterance: str) -> dict | None:
    best = None
    best_score = 0
    for item in faqs:
        tags = item.get("tags") or []
        if isinstance(tags, str):
            tags = [tags]
        score = _score(str(item.get("question") or ""), list(tags), utterance)
        if score > best_score:
            best = item
            best_score = score
    return best if best_score > 0 else None


def _bedrock_answer(utterance: str, faqs: list[dict], profile: dict | None) -> str | None:
    model_id = os.environ.get("BEDROCK_MODEL_ID", "amazon.nova-lite-v1:0")
    try:
        import boto3
    except ImportError:
        return None
    context = {
        "storeName": (profile or {}).get("name"),
        "faqs": [{"q": f.get("question"), "a": f.get("answer")} for f in faqs],
        "utterance": utterance,
        "instruction": (
            "Answer only from the provided FAQ and store name. "
            "If unknown, reply exactly: 確認いたします。担当者にご案内します。"
            " Japanese only. No inventing."
        ),
    }
    body = {
        "messages": [
            {
                "role": "user",
                "content": [{"text": json.dumps(context, ensure_ascii=False)}],
            }
        ],
        "inferenceConfig": {"maxTokens": 250, "temperature": 0},
    }
    try:
        client = boto3.client("bedrock-runtime")
        resp = client.invoke_model(
            modelId=model_id,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(body).encode("utf-8"),
        )
        payload = json.loads(resp["body"].read())
        if "output" in payload and "message" in payload["output"]:
            parts = payload["output"]["message"].get("content") or []
            return "".join(
                p.get("text", "") for p in parts if isinstance(p, dict)
            ).strip()
        return None
    except Exception:  # noqa: BLE001
        return None


def answer_faq(
    store: BookingStore, *, tenant_id: str, utterance: str
) -> dict[str, Any]:
    faqs = list_faqs(store, tenant_id)
    profile = store.get_profile(tenant_id)
    matched = match_faq(faqs, utterance)
    if matched:
        return {
            "status": "answered",
            "answer": matched.get("answer") or "",
            "faqId": str(matched.get("SK", "")).removeprefix("FAQ#"),
            "source": "faq_match",
            "action": "speak",
        }

    generated = _bedrock_answer(utterance, faqs, profile)
    if generated:
        unknown = "確認いたします" in generated
        return {
            "status": "answered" if not unknown else "unknown",
            "answer": generated,
            "faqId": "",
            "source": "bedrock",
            "action": "handoff" if unknown else "speak",
        }

    return {
        "status": "unknown",
        "answer": "確認いたします。担当者にご案内します。",
        "faqId": "",
        "source": "fallback",
        "action": "handoff",
    }
