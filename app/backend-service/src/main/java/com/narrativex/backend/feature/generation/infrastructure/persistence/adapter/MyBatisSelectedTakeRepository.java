package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.SelectedTakeRepository;
import com.narrativex.backend.feature.generation.domain.value.SelectedTake;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.SelectedTakeMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.SelectedTakeRow;
import java.time.Instant;
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
  public void saveSelection(UUID shotId, UUID takeId, long sourceInMs, long sourceOutMs) {
    SelectedTakeRow existing = mapper.findByShotId(shotId);
    Instant now = Instant.now();
    if (existing != null) {
      existing.setTakeId(takeId);
      existing.setSourceInMs(sourceInMs);
      existing.setSourceOutMs(sourceOutMs);
      existing.setUpdatedAt(now);
      mapper.update(existing);
    } else {
      SelectedTakeRow row = new SelectedTakeRow();
      row.setShotId(shotId);
      row.setTakeId(takeId);
      row.setSourceInMs(sourceInMs);
      row.setSourceOutMs(sourceOutMs);
      row.setCreatedAt(now);
      row.setUpdatedAt(now);
      mapper.insert(row);
    }
  }

  private SelectedTake toValue(SelectedTakeRow row) {
    if (row == null) return null;
    return new SelectedTake(
        row.getShotId(), row.getTakeId(), row.getSourceInMs(), row.getSourceOutMs());
  }
}
