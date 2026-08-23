package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterCreationIdempotencyRepository;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterCreationIdempotencyMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterCreationIdempotencyRow;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisChapterCreationIdempotencyAdapter
    implements ChapterCreationIdempotencyRepository {
  private final ChapterCreationIdempotencyMapper mapper;

  @Override
  public Optional<Reservation> reserve(
      String ownerId, UUID projectId, String idempotencyKey, String requestFingerprint) {
    ChapterCreationIdempotencyRow row =
        mapper.reserve(UuidV7.random(), ownerId, projectId, idempotencyKey, requestFingerprint);
    return Optional.ofNullable(row).map(MyBatisChapterCreationIdempotencyAdapter::toReservation);
  }

  @Override
  public void complete(UUID reservationId, UUID chapterId) {
    mapper.complete(reservationId, chapterId);
  }

  private static Reservation toReservation(ChapterCreationIdempotencyRow row) {
    return new Reservation(
        row.getId(),
        row.getOwnerId(),
        row.getProjectId(),
        row.getIdempotencyKey(),
        row.getRequestFingerprint(),
        row.getChapterId());
  }
}
