from __future__ import annotations

import ast
from pathlib import Path

WORKER_ROOT = Path(__file__).parents[1]


def test_core_startup_does_not_import_optional_role_dependencies() -> None:
    source = (WORKER_ROOT / "src/narrativex_worker/__main__.py").read_text(encoding="utf-8")
    tree = ast.parse(source)
    top_level_imports = {
        node.module.split(".", 1)[0]
        for node in tree.body
        if isinstance(node, ast.ImportFrom) and node.module
    }
    top_level_imports.update(
        alias.name.split(".", 1)[0]
        for node in tree.body
        if isinstance(node, ast.Import)
        for alias in node.names
    )
    assert top_level_imports.isdisjoint(
        {"torch", "torchaudio", "vieneu", "numpy", "PIL", "pydub", "ffmpeg"}
    )
