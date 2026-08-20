import asyncio
import os
import tempfile


class FfmpegAudioAssembler:
    async def encode_mp3(self, pcm_bytes: bytes, *, sample_rate_hz: int, channels: int) -> bytes:
        process = await asyncio.create_subprocess_exec(
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "s16le",
            "-ar",
            str(sample_rate_hz),
            "-ac",
            str(channels),
            "-i",
            "pipe:0",
            "-c:a",
            "libmp3lame",
            "-b:a",
            "128k",
            "-f",
            "mp3",
            "pipe:1",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate(pcm_bytes)
        if process.returncode != 0:
            raise RuntimeError(f"ffmpeg failed: {stderr.decode('utf-8', errors='replace')[:1000]}")
        if not stdout:
            raise RuntimeError("ffmpeg returned empty MP3 output")
        return stdout

    async def probe_duration_ms(self, mp3_bytes: bytes) -> int:
        return await asyncio.to_thread(self._probe_duration_ms_sync, mp3_bytes)

    @staticmethod
    def _probe_duration_ms_sync(mp3_bytes: bytes) -> int:
        path = ""
        try:
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as handle:
                handle.write(mp3_bytes)
                path = handle.name
            import subprocess

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
            )
            duration_seconds = float(result.stdout.strip())
            if duration_seconds <= 0:
                raise RuntimeError("ffprobe returned non-positive duration")
            return round(duration_seconds * 1000)
        finally:
            if path:
                try:
                    os.unlink(path)
                except FileNotFoundError:
                    pass
