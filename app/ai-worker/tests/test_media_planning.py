import pytest
from pydantic import ValidationError

from narrativex_worker.media import (
    I2vResolution,
    MotionComplexity,
    MotionStrategy,
    VisualAssetStrategy,
    VisualScenePlan,
)


def test_i2v_scene_requires_duration_and_resolution() -> None:
    with pytest.raises(ValidationError):
        VisualScenePlan(
            visual_scene_id="ch1-vs1",
            chapter_id=1,
            audio_start_ms=0,
            audio_end_ms=7000,
            source_text_start=0,
            source_text_end=120,
            motion_complexity=MotionComplexity.MEDIUM,
            asset_strategy=VisualAssetStrategy.GENERATE_NEW,
            motion_strategy=MotionStrategy.IMAGE_TO_VIDEO,
        )

    scene = VisualScenePlan(
        visual_scene_id="ch1-vs1",
        chapter_id=1,
        audio_start_ms=0,
        audio_end_ms=7000,
        source_text_start=0,
        source_text_end=120,
        motion_complexity=MotionComplexity.MEDIUM,
        asset_strategy=VisualAssetStrategy.GENERATE_NEW,
        motion_strategy=MotionStrategy.IMAGE_TO_VIDEO,
        planned_i2v_seconds=5,
        planned_i2v_resolution=I2vResolution.P480,
    )
    assert scene.planned_i2v_seconds == 5


def test_reuse_and_edit_strategies_require_source_asset_lineage() -> None:
    with pytest.raises(ValidationError):
        VisualScenePlan(
            visual_scene_id="ch1-vs2",
            chapter_id=1,
            audio_start_ms=7000,
            audio_end_ms=13000,
            source_text_start=121,
            source_text_end=220,
            motion_complexity=MotionComplexity.SIMPLE,
            asset_strategy=VisualAssetStrategy.EDIT_EXISTING,
            motion_strategy=MotionStrategy.BASIC_IMAGE_MOTION,
        )


def test_basic_motion_cannot_reserve_i2v_work() -> None:
    with pytest.raises(ValidationError):
        VisualScenePlan(
            visual_scene_id="ch1-vs3",
            chapter_id=1,
            audio_start_ms=13000,
            audio_end_ms=20000,
            source_text_start=221,
            source_text_end=300,
            motion_complexity=MotionComplexity.SIMPLE,
            asset_strategy=VisualAssetStrategy.GENERATE_NEW,
            motion_strategy=MotionStrategy.BASIC_IMAGE_MOTION,
            planned_i2v_seconds=5,
            planned_i2v_resolution=I2vResolution.P480,
        )
