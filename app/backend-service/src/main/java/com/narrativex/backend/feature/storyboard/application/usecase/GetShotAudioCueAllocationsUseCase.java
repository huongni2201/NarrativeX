package com.narrativex.backend.feature.storyboard.application.usecase;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.storyboard.application.model.ShotAudioCueAllocationSet;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess;
import com.narrativex.backend.feature.storyboard.application.port.out.ShotAudioCueAllocationRepository;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GetShotAudioCueAllocationsUseCase {
  private final StoryboardProductionAccess storyboardAccess;
  private final ShotAudioCueAllocationRepository allocationRepository;

  public ShotAudioCueAllocationSet execute(UUID projectId, UUID sequenceId) {
    var sequence = requireProjectSequence(projectId, sequenceId);
    return allocationRepository
        .findBySequenceId(sequence.id())
        .orElseGet(() -> new ShotAudioCueAllocationSet(sequenceId, 0L, List.of()));
  }

  private StoryboardProductionAccess.ShotSequenceInfo requireProjectSequence(
      UUID projectId, UUID sequenceId) {
    var sequence =
        storyboardAccess
            .findSequenceById(sequenceId)
            .orElseThrow(() -> new ResourceNotFoundException("ShotSequence not found"));
    var scopedSequence =
        storyboardAccess
            .findSequenceByVisualBeatAndProject(projectId, sequence.visualBeatId())
            .filter(candidate -> candidate.id().equals(sequenceId))
            .orElseThrow(() -> new ResourceNotFoundException("ShotSequence not found in project"));
    return scopedSequence;
  }
}
