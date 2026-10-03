package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.generation.application.port.out.TakeRepository;
import com.narrativex.backend.feature.generation.domain.enums.VideoQAFailureCategory;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.TakeMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.TakeRow;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class MyBatisTakeRepository implements TakeRepository {
  private final TakeMapper mapper;

  @Override
  public TakeRecord createPending(
      UUID shotId,
      int attemptNumber,
      String provider,
      String model,
      GenerationStrategy strategy,
      UUID generationJobId,
      UUID computeTaskId,
      UUID computeAttemptId,
      UUID operationPlanId,
      String snapshot,
      String fingerprint) {
    TakeRow row = new TakeRow();
    row.setShotId(shotId);
    row.setAttemptNumber(attemptNumber);
    row.setProvider(provider);
    row.setModel(model);
    row.setGenerationMode(strategy.name());
    row.setGenerationJobId(generationJobId);
    row.setComputeTaskId(computeTaskId);
    row.setComputeAttemptId(computeAttemptId);
    row.setOperationPlanId(operationPlanId);
    row.setInputSnapshotJson(snapshot);
    row.setInputFingerprint(fingerprint);
    UUID id = mapper.insert(row);
    if (id == null) throw new IllegalStateException("Take insert did not return an ID");
    return findById(id).orElseThrow(() -> new IllegalStateException("Inserted take disappeared"));
  }

  @Override
  public Optional<TakeRecord> findByGenerationJobId(UUID generationJobId) {
    return Optional.ofNullable(toRecord(mapper.findByGenerationJobId(generationJobId)));
  }

  @Override
  public List<
          com.narrativex.backend.feature.generation.application.model.TakeInputSnapshot.Reference>
      findReferences(UUID projectId, UUID shotId) {
    return mapper.findReferences(projectId, shotId);
  }

  @Override
  public Optional<TakeRecord> findById(UUID id) {
    TakeRow row = mapper.findById(id);
    return Optional.ofNullable(toRecord(row));
  }

  @Override
  public List<TakeRecord> findByShotId(UUID shotId) {
    return mapper.findByShotId(shotId).stream().map(this::toRecord).toList();
  }

  @Override
  public List<TakeRecord> findByShotIds(List<UUID> shotIds) {
    return mapper.findByShotIds(shotIds).stream().map(this::toRecord).toList();
  }

  @Override
  public void updateStatus(UUID id, String status) {
    mapper.updateStatus(id, status);
  }

  private TakeRecord toRecord(TakeRow row) {
    if (row == null) return null;
    GenerationStrategy strategy = GenerationStrategy.TEXT_TO_VIDEO;
    if (row.getGenerationMode() != null) {
      try {
        strategy = GenerationStrategy.valueOf(row.getGenerationMode());
      } catch (Exception ignored) {
      }
    }
    VideoQAFailureCategory category = null;
    if (row.getValidationFailureCategory() != null) {
      try {
        category = VideoQAFailureCategory.valueOf(row.getValidationFailureCategory());
      } catch (Exception ignored) {
      }
    }
    return new TakeRecord(
        row.getId(),
        row.getShotId(),
        row.getAttemptNumber(),
        row.getProvider(),
        row.getModel(),
        strategy,
        row.getOutputAssetId(),
        row.getSourceDurationMs(),
        row.getMetricsJson(),
        row.getValidationStatus(),
        category,
        row.getValidationFailureReason(),
        row.getValidationRetryRecommendation(),
        row.getStatus(),
        row.getCreatedAt(),
        row.getGenerationJobId(),
        row.getComputeTaskId(),
        row.getComputeAttemptId(),
        row.getOperationPlanId(),
        row.getInputSnapshotJson(),
        row.getInputFingerprint());
  }
}
