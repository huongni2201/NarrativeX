package com.narrativex.backend.feature.storyboard.application.model;

import java.util.UUID;

/** A complete AudioCue assigned to the Shot that owns its Native AV playback. */
public record ShotAudioCueAllocation(UUID audioCueId, UUID shotId, long audioCueRowVersion) {}
