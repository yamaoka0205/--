"""ID helpers."""

from __future__ import annotations

import time
import uuid


def new_reservation_id() -> str:
    # ULID-like: time-sortable prefix + random. Avoids adding a dependency.
    ms = int(time.time() * 1000)
    return f"{ms:013d}{uuid.uuid4().hex[:16]}"
