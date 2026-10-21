package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.storyboard.application.model.ShotAudioCueAllocation;
import com.narrativex.backend.feature.storyboard.application.model.ShotAudioCueAllocationSet;
import com.narrativex.backend.feature.storyboard.application.port.out.ShotAudioCueAllocationRepository;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ShotAudioCueAllocationMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ShotAudioCueAllocationRow;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class MyBatisShotAudioCueAllocationRepository implements ShotAudioCueAllocationRepository {
  private final ShotAudioCueAllocationMapper mapper;

  @Override
  public Optional<ShotAudioCueAllocationSet> findBySequenceId(UUID sequenceId) {
    Long rowVersion = mapper.findVersionBySequenceId(sequenceId);
    if (rowVersion == null) return Optional.empty();
    return Optional.of(
        new ShotAudioCueAllocationSet(
            sequenceId,
            rowVersion,
            mapper.findBySequenceId(sequenceId).stream()
                .map(
                    row ->
                        new ShotAudioCueAllocation(
                            row.getAudioCueId(), row.getShotId(), row.getAudioCueRowVersion()))
                .toList()));
  }

  @Override
  public Optional<UUID> findSequenceIdByAudioCueId(UUID audioCueId) {
    return Optional.ofNullable(mapper.findSequenceIdByAudioCueId(audioCueId));
  }

  @Override
  public ShotAudioCueAllocationSet replace(
      UUID sequenceId, long expectedRowVersion, List<ShotAudioCueAllocation> allocations) {
    int advanced = mapper.incrementVersion(sequenceId, expectedRowVersion);
    if (advanced == 0 && expectedRowVersion == 0) {
      advanced = mapper.insertInitialVersion(sequenceId);
    }
    if (advanced != 1) {
      throw new ResourceConflictException(
          "AudioCue allocation changed in another window; reload the ShotSequence");
    }
    mapper.deleteBySequenceId(sequenceId);
    if (!allocations.isEmpty()) {
      mapper.insertBatch(
          allocations.stream().map(allocation -> toRow(sequenceId, allocation)).toList());
    }
    return findBySequenceId(sequenceId).orElseThrow();
  }

  private static ShotAudioCueAllocationRow toRow(
      UUID sequenceId, ShotAudioCueAllocation allocation) {
    ShotAudioCueAllocationRow row = new ShotAudioCueAllocationRow();
    row.setSequenceId(sequenceId);
    row.setAudioCueId(allocation.audioCueId());
    row.setShotId(allocation.shotId());
    row.setAudioCueRowVersion(allocation.audioCueRowVersion());
    return row;
  }
}
