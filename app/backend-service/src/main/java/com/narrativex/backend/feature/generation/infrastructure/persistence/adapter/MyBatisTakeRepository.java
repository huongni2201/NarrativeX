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
        row.getCreatedAt());
  }
}
