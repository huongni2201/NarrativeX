package com.narrativex.backend.feature.storyboard.application.model;

import java.util.List;
import java.util.UUID;

/** Versioned cue ownership for a ShotSequence. */
public record ShotAudioCueAllocationSet(
    UUID sequenceId, long rowVersion, List<ShotAudioCueAllocation> allocations) {
  public ShotAudioCueAllocationSet {
    allocations = List.copyOf(allocations);
  }
}
