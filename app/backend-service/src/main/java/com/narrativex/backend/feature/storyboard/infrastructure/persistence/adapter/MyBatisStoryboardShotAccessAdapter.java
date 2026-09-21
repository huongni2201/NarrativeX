package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardShotAccess;
import com.narrativex.backend.feature.storyboard.domain.enums.RetentionRole;
import com.narrativex.backend.feature.storyboard.domain.enums.ShotStatus;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ShotMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ShotRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ShotSequenceRow;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisStoryboardShotAccessAdapter implements StoryboardShotAccess {

  private final ShotMapper shotMapper;

  @Override
  public List<ShotView> requireCurrentShots(UUID projectId, UUID chapterId) {
    Objects.requireNonNull(projectId, "projectId must not be null");
    Objects.requireNonNull(chapterId, "chapterId must not be null");
    List<ShotRow> rows = shotMapper.findCurrentShotsByChapter(projectId, chapterId);
    return rows.stream().map(this::toShotView).toList();
  }

  @Override
  public Optional<ShotView> findShotById(UUID projectId, UUID shotId) {
    Objects.requireNonNull(projectId, "projectId must not be null");
    Objects.requireNonNull(shotId, "shotId must not be null");
    ShotRow row = shotMapper.findShotByIdAndProject(projectId, shotId);
    return Optional.ofNullable(toShotView(row));
  }

  @Override
  public Optional<ShotSequenceView> findSequenceByBeatId(UUID projectId, UUID visualBeatId) {
    Objects.requireNonNull(projectId, "projectId must not be null");
    Objects.requireNonNull(visualBeatId, "visualBeatId must not be null");
    ShotSequenceRow seqRow = shotMapper.findSequenceByBeatIdAndProject(projectId, visualBeatId);
    if (seqRow == null) {
      return Optional.empty();
    }
    List<ShotRow> shotRows = shotMapper.findBySequenceId(seqRow.getId());
    List<ShotView> shotViews = shotRows.stream().map(this::toShotView).toList();
    return Optional.of(
        new ShotSequenceView(
            seqRow.getId(),
            seqRow.getRowVersion(),
            seqRow.getVisualBeatId(),
            seqRow.getOrderIndex(),
            shotViews));
  }

  @Override
  public void updateShotStatus(UUID shotId, ShotStatus status) {
    Objects.requireNonNull(shotId, "shotId must not be null");
    Objects.requireNonNull(status, "status must not be null");
    shotMapper.updateStatus(shotId, status.name());
  }

  private ShotView toShotView(ShotRow row) {
    if (row == null) {
      return null;
    }
    RetentionRole role = null;
    if (row.getRetentionRole() != null && !row.getRetentionRole().isBlank()) {
      try {
        role = RetentionRole.valueOf(row.getRetentionRole());
      } catch (IllegalArgumentException ignored) {
      }
    }
    GenerationStrategy strategy = GenerationStrategy.TEXT_TO_VIDEO;
    if (row.getGenerationStrategy() != null && !row.getGenerationStrategy().isBlank()) {
      try {
        strategy = GenerationStrategy.valueOf(row.getGenerationStrategy());
      } catch (IllegalArgumentException ignored) {
      }
    }
    ShotStatus status = ShotStatus.PLANNED;
    if (row.getStatus() != null && !row.getStatus().isBlank()) {
      try {
        status = ShotStatus.valueOf(row.getStatus());
      } catch (IllegalArgumentException ignored) {
      }
    }

    return new ShotView(
        row.getId(),
        row.getRowVersion(),
        row.getSequenceId(),
        row.getOrderIndex(),
        row.getNarrativePurpose(),
        role,
        row.getSubjectsJson(),
        row.getLocationRef(),
        row.getStartStateJson(),
        row.getActionJson(),
        row.getEndStateJson(),
        row.getCompositionJson(),
        row.getCameraJson(),
        row.getSubjectMotionJson(),
        row.getCameraMotionJson(),
        row.getEnvironmentMotionJson(),
        row.getTargetDurationMs(),
        strategy,
        row.getQualityProfile(),
        row.getContinuityFromShotId(),
        row.getContinuityToShotId(),
        status);
  }
}
