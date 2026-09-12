import re

from narrativex_worker.narration.models import NarrationSegment

# Keep synthesis/alignment boundaries close to natural speech boundaries so subtitle
# timing can reuse measured audio ranges instead of estimating inside very large TTS
# chunks. Newlines are also useful boundaries for narration text that is formatted as
# short dialogue/paragraph lines without terminal punctuation.
_BOUNDARY = re.compile(r"(?:(?<=[.!?…。！？])(?:[\"'”’)]*)[ \t]+|\r?\n+)")
_CLAUSE_BREAK_CHARS = frozenset(",;:，；：")
# Keep this in lockstep with the desktop subtitle cue ceiling. When an alignment span
# already fits one cue, subtitle timing can use the measured segment audio range exactly
# instead of subdividing that range with character-weight interpolation.
_DEFAULT_MAX_CHARS = 96


def utf16_length(value: str) -> int:
    return len(value.encode("utf-16-le")) // 2


def codepoint_to_utf16_offset(value: str, codepoint_offset: int) -> int:
    return utf16_length(value[:codepoint_offset])


class NarrationSegmenter:
    def __init__(self, max_chars: int = _DEFAULT_MAX_CHARS) -> None:
        if max_chars < 64:
            raise ValueError("max_chars must be at least 64")
        self.max_chars = max_chars

    def segment(self, source_text: str) -> list[NarrationSegment]:
        if not source_text or source_text.isspace():
            raise ValueError("source_text must not be blank")

        # Do not regroup complete sentences into a larger TTS request. Each synthesized
        # segment becomes an authoritative alignment span, so preserving sentence and
        # paragraph boundaries materially improves subtitle/audio synchronization.
        pieces: list[tuple[int, int]] = []
        cursor = 0
        for match in _BOUNDARY.finditer(source_text):
            pieces.append((cursor, match.end()))
            cursor = match.end()
        if cursor < len(source_text):
            pieces.append((cursor, len(source_text)))

        segmented: list[tuple[int, int]] = []
        for start, end in pieces:
            segmented.extend(self._split_long(source_text, start, end))

        return [
            NarrationSegment(
                index=index,
                text_start=codepoint_to_utf16_offset(source_text, start),
                text_end=codepoint_to_utf16_offset(source_text, end),
                text=source_text[start:end],
            )
            for index, (start, end) in enumerate(segmented)
        ]

    def _split_long(self, text: str, start: int, end: int) -> list[tuple[int, int]]:
        result: list[tuple[int, int]] = []
        cursor = start
        while end - cursor > self.max_chars:
            window_end = cursor + self.max_chars
            split = self._choose_natural_split(text, cursor, window_end, end)
            result.append((cursor, split))
            cursor = split
        if cursor < end:
            result.append((cursor, end))
        return result

    def _choose_natural_split(self, text: str, start: int, window_end: int, end: int) -> int:
        # Avoid producing a tiny leading fragment just to hit a punctuation mark.
        preferred_start = start + max(32, self.max_chars // 2)

        for index in range(window_end - 1, preferred_start - 1, -1):
            if text[index] not in _CLAUSE_BREAK_CHARS:
                continue
            split = index + 1
            while split < end and split < window_end and text[split].isspace():
                split += 1
            return split

        for index in range(window_end - 1, start, -1):
            if text[index].isspace():
                return index + 1

        return window_end
