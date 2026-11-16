"""Reservation dialog state machine for phone turns."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

from booking.availability import check_availability
from booking.confirm import confirm_reservation
from booking.db import BookingStore
from booking.extract import ExtractedSlots, extract_slots
from booking.timeutil import DOW_KEYS, parse_date

WEEKDAY_JA = ["月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日", "日曜日"]


@dataclass
class DialogState:
    tenant_id: str
    date: str | None = None
    time: str | None = None
    party_size: int | None = None
    name: str | None = None
    phase: str = "collect"  # collect | confirm | done
    last_prompt: str = ""
    result_status: str = ""
    reservation_id: str = ""
    missing: list[str] = field(default_factory=list)


def _missing(state: DialogState) -> list[str]:
    out = []
    if not state.date:
        out.append("date")
    if not state.time:
        out.append("time")
    if state.party_size is None:
        out.append("party_size")
    if not state.name:
        out.append("name")
    return out


def _ask_for(missing: list[str]) -> str:
    if not missing:
        return ""
    labels = {
        "date": "ご希望の日付",
        "time": "ご希望の時刻",
        "party_size": "人数",
        "name": "お名前",
    }
    if len(missing) >= 3 and missing[0] == "date":
        return "ご希望の日時と人数、お名前をお話しください。"
    first = labels[missing[0]]
    return f"{first}を教えてください。"


def _confirm_text(state: DialogState) -> str:
    d = parse_date(state.date)  # type: ignore[arg-type]
    weekday = WEEKDAY_JA[d.weekday()]
    return (
        f"{d.month}月{d.day}日 {weekday} {state.time}から、"
        f"{state.party_size}名様、{state.name}様でよろしいですか。"
        "よろしければ1を、訂正する場合は2を押してください。"
    )


def merge_slots(state: DialogState, slots: ExtractedSlots) -> DialogState:
    if slots.date:
        state.date = slots.date
    if slots.time:
        state.time = slots.time
    if slots.party_size is not None:
        state.party_size = slots.party_size
    if slots.name:
        state.name = slots.name
    state.missing = _missing(state)
    return state


def state_from_dict(data: dict[str, Any]) -> DialogState:
    return DialogState(
        tenant_id=str(data.get("tenantId") or data.get("tenant_id") or ""),
        date=data.get("date") or None,
        time=data.get("time") or data.get("startTime") or None,
        party_size=int(data["partySize"]) if data.get("partySize") not in (None, "") else None,
        name=data.get("name") or data.get("customerName") or None,
        phase=str(data.get("phase") or "collect"),
        last_prompt=str(data.get("lastPrompt") or ""),
        result_status=str(data.get("resultStatus") or ""),
        reservation_id=str(data.get("reservationId") or ""),
        missing=list(data.get("missing") or []),
    )


def state_to_dict(state: DialogState) -> dict[str, Any]:
    d = asdict(state)
    return {
        "tenantId": d["tenant_id"],
        "date": d["date"] or "",
        "time": d["time"] or "",
        "partySize": "" if d["party_size"] is None else str(d["party_size"]),
        "name": d["name"] or "",
        "phase": d["phase"],
        "lastPrompt": d["last_prompt"],
        "resultStatus": d["result_status"],
        "reservationId": d["reservation_id"],
        "missing": ",".join(d["missing"]),
    }


def handle_reservation_turn(
    store: BookingStore,
    *,
    tenant_id: str,
    utterance: str,
    state_data: dict[str, Any] | None = None,
    dtmf: str | None = None,
    caller_number: str | None = None,
    caller_number_available: bool = False,
) -> dict[str, Any]:
    state = state_from_dict({"tenantId": tenant_id, **(state_data or {})})
    state.tenant_id = tenant_id

    if state.phase == "confirm" and dtmf:
        if dtmf == "1":
            result = confirm_reservation(
                store,
                tenant_id=tenant_id,
                date_s=str(state.date),
                start_time_s=str(state.time),
                party_size=int(state.party_size),  # type: ignore[arg-type]
                customer_name=str(state.name),
                customer_phone=caller_number if caller_number_available else None,
                source="ai_phone",
            )
            if result.status == "confirmed":
                state.phase = "done"
                state.result_status = "confirmed"
                state.reservation_id = result.reservationId or ""
                state.last_prompt = "ご予約を承りました。当日お待ちしております。"
            elif result.status == "full":
                state.phase = "collect"
                state.time = None
                state.last_prompt = (
                    "申し訳ありません、その時間は満席です。別の時刻を教えてください。"
                )
            else:
                state.phase = "collect"
                state.last_prompt = (
                    f"予約を確定できませんでした。{result.reason or result.status}。"
                    "日時と人数をもう一度お願いします。"
                )
            out = state_to_dict(state)
            out["prompt"] = state.last_prompt
            out["action"] = "speak"
            return out
        if dtmf == "2":
            state.phase = "collect"
            state.last_prompt = "訂正します。ご希望の日時と人数、お名前をお話しください。"
            out = state_to_dict(state)
            out["prompt"] = state.last_prompt
            out["action"] = "speak"
            return out

    slots = extract_slots(
        utterance or "",
        known={
            "date": state.date,
            "time": state.time,
            "partySize": state.party_size,
            "name": state.name,
        },
    )
    state = merge_slots(state, slots)
    missing = _missing(state)
    state.missing = missing

    if missing:
        state.phase = "collect"
        state.last_prompt = _ask_for(missing)
        out = state_to_dict(state)
        out["prompt"] = state.last_prompt
        out["action"] = "listen"
        out["extractSource"] = slots.source
        return out

    # All fields present → availability check then confirm prompt
    avail = check_availability(
        store,
        tenant_id=tenant_id,
        date_s=str(state.date),
        start_time_s=str(state.time),
        party_size=int(state.party_size),  # type: ignore[arg-type]
    )
    if avail.status == "human_handoff":
        state.phase = "done"
        state.result_status = "human_handoff"
        state.last_prompt = "人数が多いため、担当者におつなぎします。"
        out = state_to_dict(state)
        out["prompt"] = state.last_prompt
        out["action"] = "handoff"
        return out
    if avail.status != "available":
        state.phase = "collect"
        state.time = None
        reasons = {
            "full": "その時間は満席です。別の時刻を教えてください。",
            "closed": "その日は定休日です。別の日を教えてください。",
            "outside_hours": "その時刻は営業時間外です。別の時刻を教えてください。",
            "invalid_slot": "開始時刻は15分刻みでお願いします。",
        }
        state.last_prompt = reasons.get(avail.status, "予約できない日時です。別の希望を教えてください。")
        out = state_to_dict(state)
        out["prompt"] = state.last_prompt
        out["action"] = "listen"
        return out

    state.phase = "confirm"
    state.last_prompt = _confirm_text(state)
    out = state_to_dict(state)
    out["prompt"] = state.last_prompt
    out["action"] = "confirm_dtmf"
    out["extractSource"] = slots.source
    return out
