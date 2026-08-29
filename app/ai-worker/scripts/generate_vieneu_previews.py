"""Generate and optionally publish one short VieNeu preview WAV per catalog voice.

The generated files are upload artifacts only. ``--publish-r2`` stores them through the immutable
voice-reference adapter with SHA-256 metadata. This script never creates a narration job or charges
quota.
"""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

from vieneu import Vieneu

from narrativex_worker.config import get_settings
from narrativex_worker.narration.storage import S3MediaStorage
from narrativex_worker.workspace import sha256_file

PREVIEW_TEXT = "Xin chào, đây là giọng đọc thử của NarrativeX."
R2_PREFIX = "narration/vieneu-previews"
VOICE_NAMES = {
    "vieneu-ngoc-huyen-v2": "Ngọc Huyền v2",
    "vieneu-ngoc-huyen": "Ngọc Huyền",
    "vieneu-minh-duc": "Minh Đức",
    "vieneu-thanh-binh": "Thanh Bình",
    "vieneu-truc-ly": "Trúc Ly",
    "vieneu-ngoc-linh": "Ngọc Linh",
    "vieneu-mai-anh": "Mai Anh",
    "vieneu-quynh-anh": "Quỳnh Anh",
    "vieneu-doan-trang": "Đoan Trang",
    "vieneu-pham-tuyen": "Phạm Tuyên",
    "vieneu-quang-son": "Quang Sơn",
    "vieneu-ngoc-tran": "Ngọc Trân",
    "vieneu-adam": "Adam",
    "vieneu-xuan-vinh": "Xuân Vĩnh",
    "vieneu-thai-son": "Thái Sơn",
    "vieneu-thuy-dung": "Thùy Dung",
    "vieneu-my-duyen": "Mỹ Duyên",
    "vieneu-minh-triet": "Minh Triết",
    "vieneu-duc-tri": "Đức Trí",
    "vieneu-thuc-doan": "Thục Đoan",
    "vieneu-kim-thanh": "Kim Thanh",
}


async def publish_preview(
    storage: S3MediaStorage,
    preview_path: Path,
    storage_key: str,
) -> dict[str, str | int]:
    checksum = sha256_file(preview_path)
    asset = await storage.put_file_immutable(
        storage_key=storage_key,
        file_path=preview_path,
        checksum=checksum,
        mime_type="audio/wav",
    )
    return {"sha256": asset.checksum, "sizeBytes": asset.size_bytes}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).parents[1] / "artifacts" / "vieneu-previews",
    )
    parser.add_argument("--reference-audio", type=Path, help="WAV used for Ngọc Huyền v2")
    parser.add_argument(
        "--skip-reference-voice",
        action="store_true",
        help="Generate built-in previews even when the Ngọc Huyền v2 sample is unavailable",
    )
    parser.add_argument("--backend", choices=("auto", "onnx", "pytorch"), default="auto")
    parser.add_argument("--precision", choices=("int8", "fp32"), default="int8")
    parser.add_argument(
        "--publish-r2",
        action="store_true",
        help="Publish generated previews to the configured immutable R2 voice-reference store",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    client = Vieneu(
        mode="v3turbo",
        backend=args.backend,
        precision=args.precision,
        max_batch_size=1,
    )
    available = {str(item[1]) for item in client.list_preset_voices()}
    generated: list[dict[str, str | int]] = []
    storage = S3MediaStorage(get_settings()) if args.publish_r2 else None

    for voice_id, voice_name in VOICE_NAMES.items():
        output_path = args.output_dir / f"{voice_id}.wav"
        if voice_id.endswith("-v2"):
            if args.reference_audio is None:
                if args.skip_reference_voice:
                    print("Skipped Ngọc Huyền v2: --reference-audio was not provided")
                    continue
                raise SystemExit("--reference-audio is required to generate Ngọc Huyền v2 preview")
            if not args.reference_audio.is_file():
                raise SystemExit(f"Reference audio does not exist: {args.reference_audio}")
            client.add_voice(voice_name, args.reference_audio, denoise=True, save=False)
        elif voice_name not in available:
            raise SystemExit(
                f"VieNeu SDK does not expose preset {voice_name!r}; "
                "check the installed SDK version with list_preset_voices()."
            )

        audio = client.infer(PREVIEW_TEXT, voice=voice_name)
        client.save(audio, output_path)
        storage_key = f"{R2_PREFIX}/{output_path.name}"
        integrity: dict[str, str | int] = {
            "sha256": sha256_file(output_path),
            "sizeBytes": output_path.stat().st_size,
        }
        if storage is not None:
            integrity = asyncio.run(publish_preview(storage, output_path, storage_key))
            print(f"Published {storage_key}")
        generated.append(
            {
                "voiceId": voice_id,
                "voiceName": voice_name,
                "filename": output_path.name,
                "r2Key": storage_key,
                **integrity,
            }
        )
        print(f"Generated {output_path}")

    manifest_path = args.output_dir / "manifest.json"
    manifest_path.write_text(
        json.dumps(
            {
                "provider": "VIENEU",
                "previewText": PREVIEW_TEXT,
                "files": generated,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {manifest_path}")


if __name__ == "__main__":
    main()
