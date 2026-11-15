"""Confirm a reservation with TransactWriteItems (RES + SLOT)."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from botocore.exceptions import ClientError

from booking.availability import AvailabilityResult, check_availability
from booking.db import BookingStore, to_attr_map
from booking.ids import new_reservation_id
from booking.timeutil import (
    end_time,
    format_hhmm,
    format_hhmm_key,
    parse_date,
    parse_hhmm,
    slot_starts,
)


@dataclass
class ConfirmResult:
    status: str
    tenantId: str
    reservationId: str | None = None
    date: str | None = None
    startTime: str | None = None
    endTime: str | None = None
    partySize: int | None = None
    tableId: str | None = None
    capacity: int | None = None
    customerName: str | None = None
    customerPhone: str | None = None
    source: str | None = None
    reason: str | None = None
    standardDurationMin: int | None = None

    def to_dict(self) -> dict[str, Any]:
        return {k: v for k, v in asdict(self).items() if v is not None}


def _local_iso(date_s: str, time_s: str, tz_name: str) -> str:
    day = parse_date(date_s)
    t = parse_hhmm(time_s)
    dt = datetime(
        day.year,
        day.month,
        day.day,
        t.hour,
        t.minute,
        tzinfo=ZoneInfo(tz_name),
    )
    return dt.isoformat()


def _from_availability(av: AvailabilityResult, **extra: Any) -> ConfirmResult:
    return ConfirmResult(
        status=av.status,
        tenantId=av.tenantId,
        date=av.date,
        startTime=av.startTime,
        endTime=av.endTime,
        partySize=av.partySize,
        tableId=av.tableId,
        capacity=av.capacity,
        reason=av.reason,
        standardDurationMin=av.standardDurationMin,
        **extra,
    )


def confirm_reservation(
    store: BookingStore,
    *,
    tenant_id: str,
    date_s: str,
    start_time_s: str,
    party_size: int,
    customer_name: str,
    customer_phone: str | None = None,
    source: str = "manual",
    call_id: str | None = None,
    preferred_table_id: str | None = None,
) -> ConfirmResult:
    if not customer_name or not str(customer_name).strip():
        return ConfirmResult(
            status="invalid_request",
            tenantId=tenant_id,
            reason="customer_name_required",
        )

    av = check_availability(
        store,
        tenant_id=tenant_id,
        date_s=date_s,
        start_time_s=start_time_s,
        party_size=party_size,
    )
    if av.status != "available":
        return _from_availability(av)

    profile = store.get_profile(tenant_id)
    assert profile is not None
    duration = int(profile["standardDurationMin"])
    slot_min = int(profile["reservationSlotMin"])
    tz_name = profile.get("timezone") or "Asia/Tokyo"

    candidates = list(av.candidateTableIds or [])
    if preferred_table_id and preferred_table_id in candidates:
        candidates = [preferred_table_id] + [
            t for t in candidates if t != preferred_table_id
        ]

    start = parse_hhmm(start_time_s)
    end = end_time(start, duration)
    end_s = format_hhmm(end)
    needed = slot_starts(start, duration, slot_min)
    start_key = format_hhmm_key(start)
    now = datetime.now(ZoneInfo("UTC")).replace(microsecond=0).isoformat().replace(
        "+00:00", "Z"
    )

    last_error: str | None = None
    for table_id in candidates:
        reservation_id = new_reservation_id()
        res_sk = f"RES#DATE#{date_s}#START#{start_key}#RESID#{reservation_id}"
        reservation = {
            "PK": f"TENANT#{tenant_id}",
            "SK": res_sk,
            "entityType": "RESERVATION",
            "tenantId": tenant_id,
            "reservationId": reservation_id,
            "date": date_s,
            "startTime": start_time_s,
            "endTime": end_s,
            "startAt": _local_iso(date_s, start_time_s, tz_name),
            "endAt": _local_iso(date_s, end_s, tz_name),
            "partySize": party_size,
            "customerName": customer_name.strip(),
            "tableId": table_id,
            "status": "confirmed",
            "source": source,
            "createdAt": now,
            "updatedAt": now,
            "GSI1PK": f"RESID#{reservation_id}",
            "GSI1SK": f"TENANT#{tenant_id}",
        }
        if customer_phone:
            reservation["customerPhone"] = customer_phone
        if call_id:
            reservation["callId"] = call_id

        transact_items: list[dict[str, Any]] = [
            {
                "Put": {
                    "TableName": store.table_name,
                    "Item": to_attr_map(reservation),
                    "ConditionExpression": "attribute_not_exists(PK) AND attribute_not_exists(SK)",
                }
            }
        ]
        for slot_t in needed:
            time_key = format_hhmm_key(slot_t)
            slot_sk = f"SLOT#TABLE#{table_id}#DATE#{date_s}#TIME#{time_key}"
            slot_item = {
                "PK": f"TENANT#{tenant_id}",
                "SK": slot_sk,
                "entityType": "SLOT",
                "tenantId": tenant_id,
                "tableId": table_id,
                "date": date_s,
                "slotStart": format_hhmm(slot_t),
                "reservationId": reservation_id,
                "status": "confirmed",
            }
            transact_items.append(
                {
                    "Put": {
                        "TableName": store.table_name,
                        "Item": to_attr_map(slot_item),
                        "ConditionExpression": "attribute_not_exists(PK) AND attribute_not_exists(SK)",
                    }
                }
            )

        try:
            store.client.transact_write_items(TransactItems=transact_items)
            return ConfirmResult(
                status="confirmed",
                tenantId=tenant_id,
                reservationId=reservation_id,
                date=date_s,
                startTime=start_time_s,
                endTime=end_s,
                partySize=party_size,
                tableId=table_id,
                capacity=av.capacity,
                customerName=customer_name.strip(),
                customerPhone=customer_phone,
                source=source,
                standardDurationMin=duration,
            )
        except ClientError as exc:
            if exc.response["Error"]["Code"] != "TransactionCanceledException":
                raise
            last_error = "transaction_conflict"
            continue

    return ConfirmResult(
        status="full",
        tenantId=tenant_id,
        date=date_s,
        startTime=start_time_s,
        endTime=end_s,
        partySize=party_size,
        capacity=av.capacity,
        reason=last_error or "no_free_ai_tables",
        standardDurationMin=duration,
    )
