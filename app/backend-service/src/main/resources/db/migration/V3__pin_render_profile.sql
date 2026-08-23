-- Freeze render semantics at admission time so retries cannot silently change output bytes.
-- Existing V2 snapshots are backfilled with the renderer behavior that created them.

ALTER TABLE render_input_snapshots
    ADD COLUMN render_profile_json JSONB;

UPDATE render_input_snapshots
SET render_profile_json = '{
  "schemaVersion": 1,
  "engine": "ffmpeg-python",
  "rendererVersion": "image-motion-v6-profiled-cinematic",
  "fps": 30,
  "video": {
    "encoder": "libx264",
    "x264Preset": "veryfast",
    "crf": 20,
    "nvencPreset": "p5",
    "nvencCq": 21,
    "pixelFormat": "yuv420p"
  },
  "audio": {
    "codec": "aac",
    "bitrate": "192k",
    "sampleRate": 48000
  },
  "effects": {
    "transition": "LEGACY_FADE",
    "transitionSeconds": 0.12,
    "colorGrade": "NONE",
    "backgroundMode": "COVER",
    "backgroundBlurSigma": 22.0,
    "overlayStyle": "NONE",
    "overlayOpacity": 0.30,
    "watermarkWidthRatio": 0.12,
    "watermarkOpacity": 0.82,
    "watermarkPosition": "TOP_RIGHT",
    "bgmVolume": 0.18,
    "duckThreshold": 0.08,
    "duckRatio": 8.0,
    "duckAttackMs": 20.0,
    "duckReleaseMs": 350.0,
    "motionEasing": "LINEAR",
    "textOverlays": [],
    "lutAsset": null,
    "overlayAsset": null,
    "watermarkAsset": null,
    "bgmAsset": null
  },
  "subtitles": {
    "mode": "burned-ass"
  }
}'::jsonb
WHERE render_profile_json IS NULL;

ALTER TABLE render_input_snapshots
    ALTER COLUMN render_profile_json SET NOT NULL,
    ALTER COLUMN render_profile_json SET DEFAULT '{
      "schemaVersion": 1,
      "engine": "ffmpeg-python",
      "rendererVersion": "image-motion-v6-profiled-cinematic",
      "fps": 30,
      "video": {
        "encoder": "libx264",
        "x264Preset": "veryfast",
        "crf": 20,
        "nvencPreset": "p5",
        "nvencCq": 21,
        "pixelFormat": "yuv420p"
      },
      "audio": {
        "codec": "aac",
        "bitrate": "192k",
        "sampleRate": 48000
      },
      "effects": {
        "transition": "LEGACY_FADE",
        "transitionSeconds": 0.12,
        "colorGrade": "NONE",
        "backgroundMode": "COVER",
        "backgroundBlurSigma": 22.0,
        "overlayStyle": "NONE",
        "overlayOpacity": 0.30,
        "watermarkWidthRatio": 0.12,
        "watermarkOpacity": 0.82,
        "watermarkPosition": "TOP_RIGHT",
        "bgmVolume": 0.18,
        "duckThreshold": 0.08,
        "duckRatio": 8.0,
        "duckAttackMs": 20.0,
        "duckReleaseMs": 350.0,
        "motionEasing": "LINEAR",
        "textOverlays": [],
        "lutAsset": null,
        "overlayAsset": null,
        "watermarkAsset": null,
        "bgmAsset": null
      },
      "subtitles": {
        "mode": "burned-ass"
      }
    }'::jsonb;

ALTER TABLE render_input_snapshots
    ADD CONSTRAINT ck_render_input_snapshot_profile_object
        CHECK (jsonb_typeof(render_profile_json) = 'object'),
    ADD CONSTRAINT ck_render_input_snapshot_profile_version
        CHECK ((render_profile_json ->> 'schemaVersion')::integer = 1),
    ADD CONSTRAINT ck_render_input_snapshot_renderer_version
        CHECK (length(COALESCE(render_profile_json ->> 'rendererVersion', '')) > 0);

COMMENT ON COLUMN render_input_snapshots.render_profile_json IS
    'Immutable renderer semantics pinned when the render job is admitted. Change the DB default only through a new migration and bump rendererVersion whenever output semantics change.';
