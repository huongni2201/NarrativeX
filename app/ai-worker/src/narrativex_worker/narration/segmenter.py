import re

from narrativex_worker.narration.models import NarrationSegment

_SENTENCE_END = re.compile(r"(?<=[.!?…])(?:[\"'”’)]*)\s+")


def utf16_length(value: str) -> int:
    return len(value.encode("utf-16-le")) // 2


def codepoint_to_utf16_offset(value: str, codepoint_offset: int) -> int:
    return utf16_length(value[:codepoint_offset])


class NarrationSegmenter:
    def __init__(self, max_chars: int = 1400) -> None:
        if max_chars < 64:
            raise ValueError("max_chars must be at least 64")
        self.max_chars = max_chars

    def segment(self, source_text: str) -> list[NarrationSegment]:
        if not source_text or source_text.isspace():
            raise ValueError("source_text must not be blank")

        pieces: list[tuple[int, int]] = []
        cursor = 0
        for match in _SENTENCE_END.finditer(source_text):
            pieces.append((cursor, match.end()))
            cursor = match.end()
        if cursor < len(source_text):
            pieces.append((cursor, len(source_text)))

        grouped: list[tuple[int, int]] = []
        current_start: int | None = None
        current_end = 0
        for start, end in pieces:
            if current_start is None:
                current_start, current_end = start, end
                continue
            if end - current_start <= self.max_chars:
                current_end = end
            else:
                grouped.extend(self._split_long(source_text, current_start, current_end))
                current_start, current_end = start, end
        if current_start is not None:
            grouped.extend(self._split_long(source_text, current_start, current_end))

        return [
            NarrationSegment(
                index=index,
                text_start=codepoint_to_utf16_offset(source_text, start),
                text_end=codepoint_to_utf16_offset(source_text, end),
                text=source_text[start:end],
            )
            for index, (start, end) in enumerate(grouped)
        ]

    def _split_long(self, text: str, start: int, end: int) -> list[tuple[int, int]]:
        result: list[tuple[int, int]] = []
        cursor = start
        while end - cursor > self.max_chars:
            window_end = cursor + self.max_chars
            split = max(text.rfind(" ", cursor, window_end), text.rfind("\n", cursor, window_end))
            if split <= cursor:
                split = window_end
            else:
                split += 1
            result.append((cursor, split))
            cursor = split
        if cursor < end:
            result.append((cursor, end))
        return result
