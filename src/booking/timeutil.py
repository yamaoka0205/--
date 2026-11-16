"""Time helpers for reservation slots and business hours."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

DOW_KEYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


def parse_hhmm(value: str) -> time:
    hour, minute = value.split(":")
    return time(int(hour), int(minute))


def format_hhmm(value: time) -> str:
    return f"{value.hour:02d}:{value.minute:02d}"


def format_hhmm_key(value: time) -> str:
    return f"{value.hour:02d}{value.minute:02d}"


def dow_key(d: date) -> str:
    # Monday=0 … Sunday=6
    return DOW_KEYS[d.weekday()]


def parse_date(value: str) -> date:
    return date.fromisoformat(value)


def add_minutes(t: time, minutes: int) -> time:
    base = datetime(2000, 1, 1, t.hour, t.minute)
    return (base + timedelta(minutes=minutes)).time()


def minutes_between(start: time, end: time) -> int:
    return (end.hour * 60 + end.minute) - (start.hour * 60 + start.minute)


def is_aligned(t: time, slot_min: int) -> bool:
    total = t.hour * 60 + t.minute
    return total % slot_min == 0


def slot_starts(start: time, duration_min: int, slot_min: int) -> list[time]:
    """Half-open interval: include start, exclude end."""
    if duration_min <= 0 or slot_min <= 0:
        raise ValueError("duration and slot must be positive")
    if duration_min % slot_min != 0:
        raise ValueError("duration must be a multiple of slot minutes")
    count = duration_min // slot_min
    return [add_minutes(start, i * slot_min) for i in range(count)]


def end_time(start: time, duration_min: int) -> time:
    return add_minutes(start, duration_min)


def local_now(tz_name: str) -> datetime:
    return datetime.now(ZoneInfo(tz_name))
