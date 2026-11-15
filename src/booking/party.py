"""Party size → table capacity rules."""

from __future__ import annotations


def required_capacity(party_size: int) -> int | None:
    """Return required table capacity, or None if human handoff is required."""
    if party_size < 1:
        raise ValueError("partySize must be >= 1")
    if party_size <= 4:
        return 4
    if party_size <= 6:
        return 6
    return None
