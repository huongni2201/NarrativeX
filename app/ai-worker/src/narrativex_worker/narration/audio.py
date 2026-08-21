import asyncio
import os
import subprocess
import tempfile
from pathlib import Path


class FfmpegAudioAssembler:
    async def concatenate_files(self, input_paths: list[Path], output_path: Path) -> None:
        await asyncio.to_thread(self._concatenate_files_sync, input_paths, output_path)

    @staticmethod
    def _concatenate_files_sync(input_paths: list[Path], output_path: Path) -> None:
        with output_path.open("wb") as output:
            for input_path in input_paths:
                with input_path.open("rb") as source:
                    while chunk := source.read(1024 * 1024):
                        output.write(chunk)

    async def encode_mp3_file(
        self,
        input_path: Path,
        output_path: Path,
        *,
        sample_rate_hz: int,
        channels: int,
    ) -> None:
        process = await asyncio.create_subprocess_exec(
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "s16le",
            "-ar",
            str(sample_rate_hz),
            "-ac",
            str(channels),
            "-i",
            str(input_path),
            "-c:a",
            "libmp3lame",
            "-b:a",
            "128k",
            "-f",
            "mp3",
            str(output_path),
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            _, stderr = await process.communicate()
        except asyncio.CancelledError:
            process.kill()
            await process.wait()
            raise
        if process.returncode != 0:
            raise RuntimeError(f"ffmpeg failed: {stderr.decode('utf-8', errors='replace')[:1000]}")
        if not output_path.is_file() or output_path.stat().st_size == 0:
            raise RuntimeError("ffmpeg returned empty MP3 output")

    async def encode_mp3(self, pcm_bytes: bytes, *, sample_rate_hz: int, channels: int) -> bytes:
        with tempfile.TemporaryDirectory() as directory:
            input_path = Path(directory) / "input.pcm"
            output_path = Path(directory) / "output.mp3"
            input_path.write_bytes(pcm_bytes)
            await self.encode_mp3_file(
                input_path,
                output_path,
                sample_rate_hz=sample_rate_hz,
                channels=channels,
            )
            return output_path.read_bytes()

    async def probe_duration_ms_file(self, path: Path) -> int:
        return await asyncio.to_thread(self._probe_duration_ms_sync, path)

    async def probe_duration_ms(self, mp3_bytes: bytes) -> int:
        return await asyncio.to_thread(self._probe_duration_ms_sync, mp3_bytes)

    @staticmethod
    def _probe_duration_ms_sync(media: Path | bytes) -> int:
        path = ""
        temporary_path = False
        try:
            if isinstance(media, Path):
                path = str(media)
            else:
                with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as handle:
                    handle.write(media)
                    path = handle.name
                temporary_path = True

            try:
                result = subprocess.run(
                    [
                        "ffprobe",
                        "-v",
                        "error",
                        "-show_entries",
                        "format=duration",
                        "-of",
                        "default=noprint_wrappers=1:nokey=1",
                        path,
                    ],
                    check=True,
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
            except subprocess.TimeoutExpired as exception:
                raise RuntimeError("ffprobe duration probe timed out") from exception
            duration_seconds = float(result.stdout.strip())
            if duration_seconds <= 0:
                raise RuntimeError("ffprobe returned non-positive duration")
            return round(duration_seconds * 1000)
        finally:
            if path and temporary_path:
                try:
                    os.unlink(path)
                except FileNotFoundError:
                    pass
