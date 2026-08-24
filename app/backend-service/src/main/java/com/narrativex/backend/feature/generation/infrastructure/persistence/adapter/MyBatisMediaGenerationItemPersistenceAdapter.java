package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.port.out.MediaGenerationItemRepository;
import com.narrativex.backend.feature.generation.domain.entity.MediaGenerationItem;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.MediaGenerationItemMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.MediaGenerationItemRow;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisMediaGenerationItemPersistenceAdapter implements MediaGenerationItemRepository {
  private final MediaGenerationItemMapper mapper;

  @Override
  public MediaGenerationItem save(MediaGenerationItem item) {
    if (item.getId() != null && mapper.findById(item.getId()) != null) return item;
    UUID id = mapper.insert(toRow(item));
    if (id == null)
      throw new IllegalStateException("Inserted media generation item did not return an id");
    if (!id.equals(item.getId())) {
      throw new IllegalStateException(
          "Inserted media generation item returned an unexpected id " + id);
    }
    return item;
  }

  @Override
  public Optional<MediaGenerationItem> findOwned(String userId, UUID itemId) {
    return Optional.ofNullable(mapper.findOwned(userId, itemId))
        .map(MyBatisMediaGenerationItemPersistenceAdapter::toDomain);
  }

  @Override
  public List<MediaGenerationItem> findByJobOwned(String userId, UUID jobId) {
    return mapper.findByJobOwned(userId, jobId).stream()
        .map(MyBatisMediaGenerationItemPersistenceAdapter::toDomain)
        .toList();
  }

  @Override
  public boolean review(String userId, UUID itemId, long rowVersion, String decision) {
    return mapper.review(userId, itemId, rowVersion, decision, userId) == 1;
  }

  private static MediaGenerationItemRow toRow(MediaGenerationItem item) {
    return new MediaGenerationItemRow(
        item.getId(),
        item.getRowVersion(),
        item.getGenerationJobId(),
        item.getMediaPlanId(),
        item.getVisualBeatId(),
        item.getItemKey(),
        item.getAttemptNumber(),
        item.getExecutionStatus(),
        item.getProviderOperationId(),
        item.getMediaAssetId(),
        item.getRequestFingerprint(),
        item.getErrorCode(),
        item.getErrorDetailRef(),
        item.getReviewStatus(),
        item.getReviewedByUserId(),
        item.getReviewedAt(),
        null,
        null);
  }

  private static MediaGenerationItem toDomain(MediaGenerationItemRow row) {
    if (row == null) throw new ResourceNotFoundException("Media generation item not found");
    return MediaGenerationItem.rehydrate(
        row.getId(),
        row.getRowVersion(),
        row.getGenerationJobId(),
        row.getMediaPlanId(),
        row.getVisualBeatId(),
        row.getItemKey(),
        row.getAttemptNumber(),
        row.getExecutionStatus(),
        row.getProviderOperationId(),
        row.getMediaAssetId(),
        row.getRequestFingerprint(),
        row.getErrorCode(),
        row.getErrorDetailRef(),
        row.getReviewStatus(),
        row.getReviewedByUserId(),
        row.getReviewedAt());
  }
}
