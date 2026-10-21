"""Measure take quality with one FFmpeg pass. Measurements only: verdicts live in the backend."""

import asyncio
import math
import statistics
import tempfile
from pathlib import Path

from narrativex_gpu_worker.contracts.artifact import VideoQualityMetrics

SCORER_VERSION = "FFMPEG_TAKE_QC_V2"

_HEAD_TOLERANCE_S = 0.1
_TAIL_TOLERANCE_S = 0.1
# Limited-range white is Y 235; a frame this bright on average is blown out, not merely light.
_WHITE_YAVG = 230.0
_SILENT_FLOOR_DB = -120.0
_VIDEO_FILTERS = (
    "freezedetect=n=-60dB:d=0.2,blackdetect=d=0.1,scdet=t=10,signalstats,metadata=mode=print:file=-"
)
_AUDIO_FILTERS = (
    "silencedetect=n=-50dB:d=0.3,ebur128=metadata=1,astats=metadata=1:reset=0,"
    "ametadata=mode=print:file=-"
)


class _Unavailable(Exception):
    pass


async def _measure(ffmpeg: str, path: Path, timeout_seconds: float) -> str:
    try:
        process = await asyncio.create_subprocess_exec(
            ffmpeg,
            "-v", "error", "-nostats", "-hide_banner",
            "-i", str(path),
            "-map", "0:v:0", "-vf", _VIDEO_FILTERS,
            "-map", "0:a:0?", "-af", _AUDIO_FILTERS,
            "-f", "null", "-",
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )  # fmt: skip
    except OSError as exc:
        raise _Unavailable("FFmpeg could not be started") from exc
    try:
        async with asyncio.timeout(timeout_seconds):
            output, _ = await process.communicate()
    except TimeoutError as exc:
        raise _Unavailable("FFmpeg quality scoring timed out") from exc
    finally:
        if process.returncode is None:
            process.kill()
            await process.wait()
    if process.returncode != 0:
        raise _Unavailable(f"FFmpeg exited with code {process.returncode}")
    return output.decode("utf-8", errors="replace")


def _intervals(events: list[tuple[str, float]], duration_s: float) -> list[tuple[float, float]]:
    """Pair start/end events; an interval still open at end of clip runs to the clip end."""
    intervals: list[tuple[float, float]] = []
    start: float | None = None
    for kind, value in events:
        if kind == "start":
            start = max(0.0, value)
        elif start is not None:
            intervals.append((start, min(value, duration_s)))
            start = None
    if start is not None:
        intervals.append((start, duration_s))
    return [(begin, end) for begin, end in intervals if end > begin]


def _total_ms(intervals: list[tuple[float, float]]) -> int:
    return round(sum(end - begin for begin, end in intervals) * 1000)


def _head_ms(intervals: list[tuple[float, float]]) -> int:
    for begin, end in intervals:
        if begin <= _HEAD_TOLERANCE_S:
            return round(end * 1000)
    return 0


def _tail_ms(intervals: list[tuple[float, float]], duration_s: float) -> int:
    """Length of the interval that runs to the end of the clip, 0 when the clip ends moving."""
    if intervals and intervals[-1][1] >= duration_s - _TAIL_TOLERANCE_S:
        begin, end = intervals[-1]
        return round((end - begin) * 1000)
    return 0


def _white_ms(frames: list[tuple[float, float]], duration_s: float) -> int:
    """Time spent on frames whose average luma is blown out, each held until the next frame."""
    total = 0.0
    for index, (pts, yavg) in enumerate(frames):
        if yavg < _WHITE_YAVG:
            continue
        following = frames[index + 1][0] if index + 1 < len(frames) else duration_s
        total += max(0.0, following - pts)
    return round(total * 1000)


def _spread(values: list[float]) -> float | None:
    return statistics.pstdev(values) if values else None


def _mean(values: list[float]) -> float | None:
    return statistics.fmean(values) if values else None


def _finite_or_floor(value: float | None) -> float | None:
    if value is None:
        return None
    return value if math.isfinite(value) else _SILENT_FLOOR_DB


def _parse(output: str, duration_ms: int) -> VideoQualityMetrics:
    duration_s = duration_ms / 1000
    freeze: list[tuple[str, float]] = []
    black: list[tuple[str, float]] = []
    silence: list[tuple[str, float]] = []
    ydif: list[float] = []
    yavg: list[float] = []
    ylow: list[float] = []
    yhigh: list[float] = []
    uavg: list[float] = []
    vavg: list[float] = []
    # (presentation time, average luma) per video frame; audio frames print their own headers,
    # so the time is taken from the most recent header only when the luma key follows it.
    frames: list[tuple[float, float]] = []
    pts_time = 0.0
    cuts = 0
    lufs: float | None = None
    peak: float | None = None
    for line in output.splitlines():
        if line.startswith("frame:"):
            _, _, tail = line.partition("pts_time:")
            try:
                pts_time = float(tail.split()[0])
            except (ValueError, IndexError):
                pass
            continue
        key, separator, raw = line.partition("=")
        if not separator or not key.startswith("lavfi."):
            continue
        try:
            value = float(raw)
        except ValueError:
            continue
        match key:
            case "lavfi.freezedetect.freeze_start":
                freeze.append(("start", value))
            case "lavfi.freezedetect.freeze_end":
                freeze.append(("end", value))
            case "lavfi.black_start":
                black.append(("start", value))
            case "lavfi.black_end":
                black.append(("end", value))
            case "lavfi.silence_start":
                silence.append(("start", value))
            case "lavfi.silence_end":
                silence.append(("end", value))
            case "lavfi.scd.time":
                cuts += 1
            case "lavfi.signalstats.YDIF":
                ydif.append(value)
            case "lavfi.signalstats.YAVG":
                yavg.append(value)
                frames.append((pts_time, value))
            case "lavfi.signalstats.YLOW":
                ylow.append(value)
            case "lavfi.signalstats.YHIGH":
                yhigh.append(value)
            case "lavfi.signalstats.UAVG":
                uavg.append(value)
            case "lavfi.signalstats.VAVG":
                vavg.append(value)
            case "lavfi.r128.I":
                lufs = value
            case "lavfi.astats.Overall.Peak_level":
                peak = value
    if not yavg:
        raise _Unavailable("No measurable video frames")
    freeze_intervals = _intervals(freeze, duration_s)
    # Signed deltas: a steady fade is a constant delta (no flicker), an oscillation is not.
    jumps = [later - earlier for earlier, later in zip(yavg, yavg[1:], strict=False)]
    return VideoQualityMetrics(
        status="MEASURED",
        scorer_version=SCORER_VERSION,
        freeze_head_ms=_head_ms(freeze_intervals),
        freeze_tail_ms=_tail_ms(freeze_intervals, duration_s),
        freeze_total_ms=_total_ms(freeze_intervals),
        motion_mean=statistics.fmean(ydif) if ydif else None,
        scene_cut_count=cuts,
        flicker_stddev=statistics.pstdev(jumps) if jumps else 0.0,
        black_total_ms=_total_ms(_intervals(black, duration_s)),
        white_total_ms=_white_ms(frames, duration_s),
        silence_total_ms=_total_ms(_intervals(silence, duration_s)) if lufs is not None else None,
        integrated_lufs=_finite_or_floor(lufs),
        peak_dbfs=_finite_or_floor(peak),
        mean_y=statistics.fmean(yavg),
        mean_u=statistics.fmean(uavg) if uavg else None,
        mean_v=statistics.fmean(vavg) if vavg else None,
        stddev_y=_spread(yavg),
        stddev_u=_spread(uavg),
        stddev_v=_spread(vavg),
        low_y=_mean(ylow),
        high_y=_mean(yhigh),
    )


async def score_video_quality(
    content: bytes,
    *,
    duration_ms: int,
    ffmpeg: str = "ffmpeg",
    timeout_seconds: float = 60.0,
) -> VideoQualityMetrics:
    """Never raises: scoring is advisory and must not fail the video task."""
    try:
        with tempfile.TemporaryDirectory(prefix="narrativex-take-qc-") as directory:
            path = Path(directory) / "take.mp4"
            await asyncio.to_thread(path.write_bytes, content)
            output = await _measure(ffmpeg, path, timeout_seconds)
        return _parse(output, duration_ms)
    except _Unavailable as exc:
        return VideoQualityMetrics(
            status="UNAVAILABLE", scorer_version=SCORER_VERSION, reason=str(exc)
        )
    except OSError:
        return VideoQualityMetrics(
            status="UNAVAILABLE",
            scorer_version=SCORER_VERSION,
            reason="Scratch space for scoring is unavailable",
        )
