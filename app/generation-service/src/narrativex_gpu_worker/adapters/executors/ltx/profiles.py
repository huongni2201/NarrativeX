"""Pinned LTX workflow profiles, selected by operator configuration.

Each profile is a `<name>.manifest.json` next to its pinned graph. Selecting a profile never
loosens pinning: the graph digest, model checksums and runtime commit stay enforced, and an
unknown profile fails closed instead of falling back to another one.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

WORKFLOWS = Path(__file__).with_name("workflows")
DEFAULT_PROFILE_ID = "ltx-2.5-22b-distilled-int8-native-av-v1"

# Node bindings of the native-av graph; a manifest may override them for its own graph.
DEFAULT_BINDINGS = {
    "positivePrompt": "2612",
    "negativePrompt": "2483",
    "videoLength": "3059",
    "audioFrames": "3980",
    "seed": "4832",
}


@dataclass(frozen=True, slots=True)
class LtxProfile:
    profile_id: str
    manifest: dict[str, Any]
    graph_path: Path
    checkpoint: str
    min_vram_mb: int
    vram_budget_mb: int
    bindings: dict[str, str]

    @property
    def model_id(self) -> str:
        return str(self.manifest["modelId"])

    @property
    def model_revision(self) -> str:
        return str(self.manifest["modelRevision"])


def _load(manifest_path: Path) -> LtxProfile:
    manifest: dict[str, Any] = json.loads(manifest_path.read_text())
    graph = manifest.get("workflowFile") or manifest_path.name.replace(".manifest.json", ".json")
    if Path(graph).name != graph:
        raise ValueError(f"Profile graph must be a sibling file: {manifest_path.name}")
    checkpoint = manifest.get("checkpoint")
    if not checkpoint:
        raise ValueError(f"Profile checkpoint missing: {manifest_path.name}")
    min_vram = manifest.get("minVramMb")
    if not isinstance(min_vram, int) or min_vram <= 0:
        raise ValueError(f"Profile minVramMb missing: {manifest_path.name}")
    return LtxProfile(
        profile_id=str(manifest["profileId"]),
        manifest=manifest,
        graph_path=WORKFLOWS / graph,
        checkpoint=str(checkpoint),
        min_vram_mb=min_vram,
        vram_budget_mb=int(manifest.get("vramBudgetMb", min_vram)),
        bindings=DEFAULT_BINDINGS | dict(manifest.get("bindings", {})),
    )


@lru_cache
def available_profiles() -> dict[str, LtxProfile]:
    profiles: dict[str, LtxProfile] = {}
    for path in sorted(WORKFLOWS.glob("*.manifest.json")):
        profile = _load(path)
        if profile.profile_id in profiles:
            raise ValueError(f"Duplicate LTX profile id: {profile.profile_id}")
        profiles[profile.profile_id] = profile
    return profiles


def resolve_profile(profile_id: str | None = None) -> LtxProfile:
    wanted = (profile_id or "").strip() or DEFAULT_PROFILE_ID
    profiles = available_profiles()
    if wanted not in profiles:
        known = ", ".join(sorted(profiles))
        raise ValueError(f"Unknown LTX profile '{wanted}'. Available: {known}")
    return profiles[wanted]


__all__ = [
    "DEFAULT_PROFILE_ID",
    "LtxProfile",
    "available_profiles",
    "resolve_profile",
]
