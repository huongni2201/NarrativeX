"""Render one 10-15 second WAV sample per VieNeu preset voice.

Runs wherever the `vieneu` package is installed (the generation-service image has it; v3 Turbo works
on CPU). Upload the output to R2 under narration/vieneu-previews/ - V7 seeds sample_url as
https://media.narrativex.cloud/narration/vieneu-previews/vieneu-<slug>.wav.

    python generate-voice-samples.py --seed V7__seed_catalog.sql --text-source vieneu-voices.ts --out out [--force]

The seed supplies slugs and names; the text comes from VOICE_SAMPLE_TEXT in vieneu-voices.ts.
"""

from __future__ import annotations

import argparse
import re
import sys
import time
import wave
from pathlib import Path

MIN_SECONDS = 10.0
MAX_SECONDS = 15.0


def read_presets(seed: Path) -> list[tuple[str, str]]:
    pattern = re.compile(r"^\s*\('([a-z0-9-]+)',\s*'([^']+)',\s*(?:TRUE|FALSE),", re.MULTILINE)
    presets = pattern.findall(seed.read_text(encoding="utf-8"))
    if not presets:
        sys.exit(f"No VieNeu presets found in {seed}")
    return presets


def read_sample_text(source: Path) -> str:
    match = re.search(r'VOICE_SAMPLE_TEXT =\s*"([^"]+)"', source.read_text(encoding="utf-8"))
    if not match:
        sys.exit(f"VOICE_SAMPLE_TEXT not found in {source}")
    return match.group(1)


def wav_seconds(path: Path) -> float:
    with wave.open(str(path), "rb") as wav:
        return wav.getnframes() / wav.getframerate()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--seed", type=Path, required=True)
    parser.add_argument("--text-source", type=Path, required=True)
    parser.add_argument("--out", type=Path, default=Path("voice-samples"))
    parser.add_argument("--force", action="store_true", help="re-render files that already exist")
    args = parser.parse_args()

    presets = read_presets(args.seed)
    text = read_sample_text(args.text_source)
    args.out.mkdir(parents=True, exist_ok=True)

    from vieneu import Vieneu  # imported late so --help works without the model stack

    print(f"Loading VieNeu v3 Turbo ({len(presets)} voices -> {args.out})", flush=True)
    tts = Vieneu(mode="v3turbo")
    available = {name for _, name in tts.list_preset_voices()}
    unknown = [name for _, name in presets if name not in available]
    if unknown:
        print(f"WARNING: not in this VieNeu build, skipped: {', '.join(unknown)}", file=sys.stderr)

    failed: list[str] = []
    out_of_range: list[str] = []
    for slug, name in presets:
        target = args.out / f"vieneu-{slug}.wav"
        if name in unknown:
            failed.append(slug)
            continue
        if target.exists() and not args.force:
            print(f"skip   {slug} (exists)", flush=True)
            continue
        started = time.time()
        try:
            audio = tts.infer(text=text, voice=tts.get_preset_voice(name), show_progress=False)
            tts.save(audio, target)
            seconds = wav_seconds(target)
        except Exception as error:  # one bad voice must not stop the batch
            failed.append(slug)
            print(f"FAILED {slug}: {error}", file=sys.stderr, flush=True)
            continue
        flagged = not MIN_SECONDS <= seconds <= MAX_SECONDS
        if flagged:
            out_of_range.append(f"{slug} {seconds:.1f}s")
        print(f"ok     {slug}  {seconds:.1f}s  (rendered in {time.time() - started:.0f}s){'  OUTSIDE 10-15s' if flagged else ''}", flush=True)

    if out_of_range:
        print(f"\nOutside {MIN_SECONDS:.0f}-{MAX_SECONDS:.0f}s: {', '.join(out_of_range)}. "
              "Adjust VOICE_SAMPLE_TEXT and rerun with --force.", file=sys.stderr)
    if failed:
        print(f"\n{len(failed)} voice(s) failed: {', '.join(failed)}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
