"""Provider-neutral visual directing helpers for the still-image MVP.

The rules are intentionally model-agnostic. They borrow general directing ideas such as clear
subject/action, composition, motivated light, continuity and explicit exclusions, but do not
embed Seedance-specific video syntax or API assumptions.
"""

from __future__ import annotations

import re

VISUAL_DIRECTION_INSTRUCTIONS = (
    "For every visual beat, write visual_intent as a production-ready still-image direction, not "
    "as generic prose. Describe: (1) the primary subject and one readable physical action or "
    "state, (2) environment and the story-relevant prop/detail, (3) shot size and camera angle, "
    "(4) composition and what must remain visually dominant, (5) one physically motivated light "
    "source and atmosphere, (6) restrained facial/body performance when a character is present, "
    "and (7) continuity constraints that preserve established character appearance, costume, "
    "location and time-of-day. Prefer concrete visible details over adjectives such as cinematic, "
    "beautiful, epic or dramatic. Do not invent text, logos, subtitles, watermarks, extra people, "
    "or story facts unsupported by the chapter. Keep each beat suitable for generating one static "
    "key image that can later receive subtle FFmpeg motion."
)


_REVEAL_TERMS = re.compile(
    r"\b(reveal|discover|realize|realise|recognize|recognise|notice|secret|truth|"
    r"phát hiện|nhận ra|bí mật|sự thật)\b",
    re.IGNORECASE,
)
_ESTABLISH_TERMS = re.compile(
    r"\b(establish|landscape|city|village|room|location|environment|toàn cảnh|"
    r"khung cảnh|thành phố|ngôi làng|căn phòng)\b",
    re.IGNORECASE,
)
_ISOLATION_TERMS = re.compile(
    r"\b(alone|lonely|isolated|leaves|walks away|goodbye|một mình|cô độc|rời đi|chia tay)\b",
    re.IGNORECASE,
)
_PORTRAIT_TERMS = re.compile(
    r"\b(close[- ]?up|portrait|face|expression|reaction|cận cảnh|chân dung|biểu cảm|phản ứng)\b",
    re.IGNORECASE,
)
_VERTICAL_TERMS = re.compile(
    r"\b(look up|look down|tower|building|stairs|sky|ceiling|ngước lên|cúi xuống|"
    r"tòa nhà|cầu thang|bầu trời|trần nhà)\b",
    re.IGNORECASE,
)


def choose_ffmpeg_camera_movement(title: str, visual_intent: str) -> str:
    """Choose one conservative still-image camera move from authored beat semantics.

    This stays deterministic so the same storyboard revision produces the same render plan and is
    deliberately biased toward subtle motion. Unknown or ambiguous beats remain static.
    """

    text = f"{title}\n{visual_intent}".strip()
    if not text:
        return "NONE"
    if _REVEAL_TERMS.search(text):
        return "PUSH_IN"
    if _ISOLATION_TERMS.search(text):
        return "PULL_OUT"
    if _PORTRAIT_TERMS.search(text):
        return "PARALLAX"
    if _VERTICAL_TERMS.search(text):
        return "TILT"
    if _ESTABLISH_TERMS.search(text):
        return "PAN"
    return "NONE"
