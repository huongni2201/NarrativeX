"""RFC 9562 UUIDv7 generation for durable worker-side identifiers."""

from secrets import randbits
from time import time_ns
from uuid import UUID


def uuid7() -> UUID:
    """Return a time-ordered RFC 9562 UUID version 7."""
    unix_ms = time_ns() // 1_000_000
    if unix_ms < 0 or unix_ms >= (1 << 48):
        raise OverflowError("Unix timestamp milliseconds do not fit UUIDv7")

    value = unix_ms << 80
    value |= 0x7 << 76
    value |= randbits(12) << 64
    value |= 0b10 << 62
    value |= randbits(62)
    return UUID(int=value)
