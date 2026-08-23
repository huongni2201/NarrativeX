package com.narrativex.backend.feature.project.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.project.application.port.out.ChapterCreationIdempotencyRepository;
import com.narrativex.backend.feature.project.infrastructure.persistence.mybatis.ChapterCreationIdempotencyMapper;
import com.narrativex.backend.feature.project.infrastructure.persistence.mybatis.ChapterCreationIdempotencyRow;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisChapterCreationIdempotencyAdapter
    implements ChapterCreationIdempotencyRepository {
  private final ChapterCreationIdempotencyMapper mapper;

  @Override
  public Optional<Reservation> reserve(
      String ownerId, Long projectId, String idempotencyKey, String requestFingerprint) {
    ChapterCreationIdempotencyRow row =
        mapper.reserve(ownerId, projectId, idempotencyKey, requestFingerprint);
    return Optional.ofNullable(row).map(MyBatisChapterCreationIdempotencyAdapter::toReservation);
  }

  @Override
  public void complete(Long reservationId, Long chapterId) {
    if (mapper.complete(reservationId, chapterId) != 1) {
      throw new IllegalStateException("Chapter creation reservation was modified concurrently");
    }
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
