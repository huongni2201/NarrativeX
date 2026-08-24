from time import time_ns
from uuid import RFC_4122

from narrativex_worker.uuid_v7 import uuid7


def test_uuid7_uses_rfc9562_version_and_variant() -> None:
    value = uuid7()

    assert value.version == 7
    assert value.variant == RFC_4122


def test_uuid7_embeds_current_unix_milliseconds() -> None:
    before_ms = time_ns() // 1_000_000
    value = uuid7()
    after_ms = time_ns() // 1_000_000

    embedded_ms = value.int >> 80
    assert before_ms <= embedded_ms <= after_ms
