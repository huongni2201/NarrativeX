ALTER TABLE visual_beats
    ADD COLUMN visual_direction_json TEXT;

COMMENT ON COLUMN visual_beats.visual_direction_json IS
    'Provider-neutral VisualDirection JSON authored during chapter analysis; legacy camera columns remain compatibility projections during cut-over.';
