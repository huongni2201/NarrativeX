package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.generation.application.port.out.SelectedTakeRepository;
import com.narrativex.backend.feature.generation.domain.value.SelectedTake;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.SelectedTakeMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.SelectedTakeRow;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class MyBatisSelectedTakeRepository implements SelectedTakeRepository {
  private final SelectedTakeMapper mapper;

  @Override
  public Optional<SelectedTake> findByShotId(UUID shotId) {
    SelectedTakeRow row = mapper.findByShotId(shotId);
    return Optional.ofNullable(toValue(row));
  }

  @Override
  public List<SelectedTake> findByShotIds(List<UUID> shotIds) {
    return mapper.findByShotIds(shotIds).stream().map(this::toValue).toList();
  }

  @Override
  public SelectedTake saveSelection(
      UUID shotId,
      UUID takeId,
      long sourceInMs,
      long sourceOutMs,
      long expectedRowVersion,
      String reviewFingerprint,
      String reviewChecklistJson) {
    int updated =
        mapper.updateSelection(
            shotId,
            takeId,
            sourceInMs,
            sourceOutMs,
            expectedRowVersion,
            reviewFingerprint,
            reviewChecklistJson);
    if (updated == 0 && expectedRowVersion == 0) {
      updated =
          mapper.insertSelection(
              shotId, takeId, sourceInMs, sourceOutMs, reviewFingerprint, reviewChecklistJson);
    }
    if (updated != 1) {
      throw new ResourceConflictException(
          "Selected Take changed in another window; reload the Shot before selecting again");
    }
    return toValue(mapper.findByShotId(shotId));
  }

  private SelectedTake toValue(SelectedTakeRow row) {
    if (row == null) return null;
    return new SelectedTake(
        row.getShotId(),
        row.getTakeId(),
        row.getSourceInMs(),
        row.getSourceOutMs(),
        row.getRowVersion(),
        row.getReviewFingerprint(),
        row.getReviewChecklistJson(),
        row.getReviewedAt());
  }
}
