"""Check availability for a tenant/date/time/party size."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from booking.db import BookingStore, slot_is_occupied
from booking.party import required_capacity
from booking.timeutil import (
    dow_key,
    end_time,
    format_hhmm,
    format_hhmm_key,
    is_aligned,
    parse_date,
    parse_hhmm,
    slot_starts,
)


@dataclass
class AvailabilityResult:
    status: str
    tenantId: str
    date: str | None = None
    startTime: str | None = None
    endTime: str | None = None
    partySize: int | None = None
    tableId: str | None = None
    capacity: int | None = None
    candidateTableIds: list[str] | None = None
    reason: str | None = None
    standardDurationMin: int | None = None

    def to_dict(self) -> dict[str, Any]:
        return {k: v for k, v in asdict(self).items() if v is not None}


def check_availability(
    store: BookingStore,
    *,
    tenant_id: str,
    date_s: str,
    start_time_s: str,
    party_size: int,
) -> AvailabilityResult:
    profile = store.get_profile(tenant_id)
    if not profile or profile.get("status") != "active":
        return AvailabilityResult(
            status="not_found",
            tenantId=tenant_id,
            reason="tenant_not_found_or_inactive",
        )

    duration = int(profile["standardDurationMin"])
    slot_min = int(profile["reservationSlotMin"])

    try:
        day = parse_date(date_s)
        start = parse_hhmm(start_time_s)
    except ValueError:
        return AvailabilityResult(
            status="invalid_request",
            tenantId=tenant_id,
            reason="invalid_date_or_time",
        )

    if party_size < 1:
        return AvailabilityResult(
            status="invalid_request",
            tenantId=tenant_id,
            reason="invalid_party_size",
        )

    capacity = required_capacity(party_size)
    if capacity is None:
        return AvailabilityResult(
            status="human_handoff",
            tenantId=tenant_id,
            date=date_s,
            startTime=start_time_s,
            partySize=party_size,
            reason="party_size_requires_human",
            standardDurationMin=duration,
        )

    if not is_aligned(start, slot_min):
        return AvailabilityResult(
            status="invalid_slot",
            tenantId=tenant_id,
            date=date_s,
            startTime=start_time_s,
            partySize=party_size,
            reason=f"start_must_align_to_{slot_min}_min",
            standardDurationMin=duration,
        )

    hours = store.get_hours(tenant_id, dow_key(day))
    if not hours:
        return AvailabilityResult(
            status="closed",
            tenantId=tenant_id,
            date=date_s,
            startTime=start_time_s,
            partySize=party_size,
            reason="hours_not_configured",
            standardDurationMin=duration,
        )
    if hours.get("isClosed"):
        return AvailabilityResult(
            status="closed",
            tenantId=tenant_id,
            date=date_s,
            startTime=start_time_s,
            partySize=party_size,
            reason="closed_day",
            standardDurationMin=duration,
        )

    open_t = parse_hhmm(hours["openTime"])
    close_t = parse_hhmm(hours["closeTime"])
    last_start_s = hours.get("lastStartTime")
    if last_start_s:
        last_start = parse_hhmm(last_start_s)
    else:
        close_minutes = close_t.hour * 60 + close_t.minute
        last_minutes = close_minutes - duration
        if last_minutes < 0:
            return AvailabilityResult(
                status="closed",
                tenantId=tenant_id,
                date=date_s,
                startTime=start_time_s,
                partySize=party_size,
                reason="invalid_hours_vs_duration",
                standardDurationMin=duration,
            )
        last_start = parse_hhmm(f"{last_minutes // 60:02d}:{last_minutes % 60:02d}")

    end = end_time(start, duration)
    if start < open_t or start > last_start:
        return AvailabilityResult(
            status="outside_hours",
            tenantId=tenant_id,
            date=date_s,
            startTime=start_time_s,
            endTime=format_hhmm(end),
            partySize=party_size,
            reason="outside_open_or_last_start",
            standardDurationMin=duration,
        )
    if end > close_t:
        return AvailabilityResult(
            status="outside_hours",
            tenantId=tenant_id,
            date=date_s,
            startTime=start_time_s,
            endTime=format_hhmm(end),
            partySize=party_size,
            reason="end_after_close",
            standardDurationMin=duration,
        )

    needed_slots = slot_starts(start, duration, slot_min)
    tables = [
        t
        for t in store.list_tables(tenant_id)
        if t.get("active")
        and t.get("aiBookable")
        and int(t.get("capacity", 0)) == capacity
    ]
    tables.sort(key=lambda t: int(t.get("sortOrder", 0)))

    free_ids: list[str] = []
    for table in tables:
        table_id = table["tableId"]
        occupied = False
        for slot_t in needed_slots:
            slot = store.get_slot(
                tenant_id, table_id, date_s, format_hhmm_key(slot_t)
            )
            if slot_is_occupied(slot):
                occupied = True
                break
        if not occupied:
            free_ids.append(table_id)

    if not free_ids:
        return AvailabilityResult(
            status="full",
            tenantId=tenant_id,
            date=date_s,
            startTime=start_time_s,
            endTime=format_hhmm(end),
            partySize=party_size,
            capacity=capacity,
            candidateTableIds=[],
            reason="no_free_ai_tables",
            standardDurationMin=duration,
        )

    return AvailabilityResult(
        status="available",
        tenantId=tenant_id,
        date=date_s,
        startTime=start_time_s,
        endTime=format_hhmm(end),
        partySize=party_size,
        tableId=free_ids[0],
        capacity=capacity,
        candidateTableIds=free_ids,
        standardDurationMin=duration,
    )
