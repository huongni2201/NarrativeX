package com.narrativex.backend.feature.assets.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.assets.application.port.out.MediaStorageCleanupTaskRepository;
import com.narrativex.backend.feature.assets.application.port.out.MediaStorageCleanupTaskRepository.CleanupTask;
import com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis.MediaStorageCleanupTaskMapper;
import com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis.MediaStorageCleanupTaskRow;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class MyBatisMediaStorageCleanupTaskRepository implements MediaStorageCleanupTaskRepository {
  private final MediaStorageCleanupTaskMapper mapper;

  @Override
  @Transactional
  public void enqueue(String storageKey, String reason, Instant nextAttemptAt) {
    mapper.enqueue(UUID.randomUUID(), storageKey, reason, nextAttemptAt);
  }

  @Override
  @Transactional
  public List<CleanupTask> claimDue(int limit, Instant now, Instant leaseUntil) {
    if (limit < 1 || limit > 500) {
      throw new IllegalArgumentException("limit must be between 1 and 500");
    }
    return mapper.claimDue(now, leaseUntil, limit).stream()
        .map(MyBatisMediaStorageCleanupTaskRepository::toTask)
        .toList();
  }

  @Override
  @Transactional
  public void markCompleted(UUID id, Instant completedAt) {
    mapper.markCompleted(id, completedAt);
  }

  @Override
  @Transactional
  public void markFailed(UUID id, Instant nextAttemptAt, String lastError) {
    mapper.markFailed(id, nextAttemptAt, truncate(lastError));
  }

  private static CleanupTask toTask(MediaStorageCleanupTaskRow row) {
    return new CleanupTask(
        row.getId(),
        row.getStorageKey(),
        row.getReason(),
        row.getStatus(),
        row.getAttemptCount(),
        row.getNextAttemptAt());
  }

  private static String truncate(String value) {
    if (value == null) return null;
    return value.length() <= 1000 ? value : value.substring(0, 1000);
  }
}
