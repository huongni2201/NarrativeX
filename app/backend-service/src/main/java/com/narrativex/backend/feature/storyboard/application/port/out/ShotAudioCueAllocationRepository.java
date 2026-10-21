package com.narrativex.backend.feature.storyboard.application.port.out;

import com.narrativex.backend.feature.storyboard.application.model.ShotAudioCueAllocation;
import com.narrativex.backend.feature.storyboard.application.model.ShotAudioCueAllocationSet;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ShotAudioCueAllocationRepository {
  Optional<ShotAudioCueAllocationSet> findBySequenceId(UUID sequenceId);

  Optional<UUID> findSequenceIdByAudioCueId(UUID audioCueId);

  ShotAudioCueAllocationSet replace(
      UUID sequenceId, long expectedRowVersion, List<ShotAudioCueAllocation> allocations);
}
