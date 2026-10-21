package com.narrativex.backend.feature.storyboard.application.usecase;

import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.storyboard.application.model.ShotAudioCueAllocation;
import com.narrativex.backend.feature.storyboard.application.model.ShotAudioCueAllocationSet;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess;
import com.narrativex.backend.feature.storyboard.application.port.out.ShotAudioCueAllocationRepository;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ReplaceShotAudioCueAllocationsUseCase {
  private final StoryboardProductionAccess storyboardAccess;
  private final ShotAudioCueAllocationRepository allocationRepository;

  @Transactional
  public ShotAudioCueAllocationSet execute(
      UUID projectId, UUID sequenceId, long expectedRowVersion, List<Assignment> assignments) {
    if (expectedRowVersion < 0) {
      throw new IllegalArgumentException("expectedRowVersion must not be negative");
    }
    if (assignments == null) throw new IllegalArgumentException("assignments must not be null");

    var sequence = requireProjectSequence(projectId, sequenceId);
    var visualBeat =
        storyboardAccess
            .findVisualBeat(sequence.visualBeatId())
            .orElseThrow(() -> new ResourceNotFoundException("VisualBeat not found"));
    List<StoryboardProductionAccess.AudioCueInfo> cues =
        visualBeat.storyBeatId() == null
            ? List.of()
            : storyboardAccess.findAudioCues(List.of(visualBeat.storyBeatId()));
    List<StoryboardProductionAccess.ShotInfo> shots =
        storyboardAccess.findShotsBySequence(sequenceId);

    Map<UUID, StoryboardProductionAccess.AudioCueInfo> cuesById = new HashMap<>();
    cues.forEach(cue -> cuesById.put(cue.id(), cue));
    Set<UUID> shotIds = new HashSet<>();
    shots.forEach(shot -> shotIds.add(shot.id()));
    Set<UUID> assignedCueIds = new HashSet<>();
    var allocations = new java.util.ArrayList<ShotAudioCueAllocation>();

    for (Assignment assignment : assignments) {
      if (!assignedCueIds.add(assignment.audioCueId())) {
        throw new DomainValidationException(
            "AUDIO_CUE_DUPLICATE_ALLOCATION: cue assigned more than once");
      }
      var cue = cuesById.get(assignment.audioCueId());
      if (cue == null) {
        throw new DomainValidationException(
            "AUDIO_CUE_OUTSIDE_VISUAL_BEAT: cue does not belong to this Beat");
      }
      if (!shotIds.contains(assignment.shotId())) {
        throw new DomainValidationException(
            "SHOT_OUTSIDE_SEQUENCE: target Shot does not belong to this sequence");
      }
      allocationRepository
          .findSequenceIdByAudioCueId(assignment.audioCueId())
          .filter(existingSequenceId -> !existingSequenceId.equals(sequenceId))
          .ifPresent(
              existingSequenceId -> {
                throw new DomainValidationException(
                    "AUDIO_CUE_ALREADY_ALLOCATED: cue already has a playback owner in another sequence");
              });
      allocations.add(new ShotAudioCueAllocation(cue.id(), assignment.shotId(), cue.rowVersion()));
    }

    if (!assignments.isEmpty() && assignedCueIds.size() != cues.size()) {
      throw new DomainValidationException(
          "AUDIO_CUE_ALLOCATION_INCOMPLETE: allocate every complete AudioCue exactly once");
    }
    if (shots.size() > 1 && !cues.isEmpty() && assignedCueIds.size() != cues.size()) {
      throw new DomainValidationException(
          "AUDIO_CUE_ALLOCATION_REQUIRED: allocate every complete AudioCue to one Shot");
    }

    return allocationRepository.replace(sequenceId, expectedRowVersion, allocations);
  }

  private StoryboardProductionAccess.ShotSequenceInfo requireProjectSequence(
      UUID projectId, UUID sequenceId) {
    var sequence =
        storyboardAccess
            .findSequenceById(sequenceId)
            .orElseThrow(() -> new ResourceNotFoundException("ShotSequence not found"));
    return storyboardAccess
        .findSequenceByVisualBeatAndProject(projectId, sequence.visualBeatId())
        .filter(candidate -> candidate.id().equals(sequenceId))
        .orElseThrow(() -> new ResourceNotFoundException("ShotSequence not found in project"));
  }

  public record Assignment(UUID audioCueId, UUID shotId) {
    public Assignment {
      if (audioCueId == null || shotId == null) {
        throw new IllegalArgumentException("audioCueId and shotId are required");
      }
    }
  }
}
