package com.narrativex.backend.feature.assets.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository.CreateUploadSession;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository.ExpiredUpload;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository.RejectedUpload;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository.UploadSession;
import com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis.MediaUploadSessionMapper;
import com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis.MediaUploadSessionRow;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class MyBatisMediaUploadSessionRepository implements MediaUploadSessionRepository {
  private final MediaUploadSessionMapper mapper;

  @Override
  @Transactional
  public UploadSession create(CreateUploadSession command) {
    int inserted = mapper.insert(command);
    if (inserted == 1) {
      return findSnapshot(command.id())
          .orElseThrow(() -> new IllegalStateException("Upload session disappeared after insert"));
    }
    if (command.idempotencyKey() == null) {
      throw new IllegalStateException(
          "Upload session insert was skipped without an idempotency key");
    }
    UploadSession winner =
        findByIdempotencyKey(command.idempotencyKey())
            .orElseThrow(
                () ->
                    new IllegalStateException(
                        "Idempotency conflict occurred but the winning upload session was not found"));
    if (!sameCreateRequest(winner, command)) {
      throw new ResourceConflictException("Idempotency key was already used for another upload");
    }
    return winner;
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<UploadSession> findSnapshot(UUID id) {
    return Optional.ofNullable(mapper.findSnapshot(id)).map(this::toSession);
  }

  @Override
  @Transactional(propagation = Propagation.MANDATORY)
  public Optional<UploadSession> findForUpdate(UUID id) {
    return Optional.ofNullable(mapper.findForUpdate(id)).map(this::toSession);
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<UploadSession> findByIdempotencyKey(String idempotencyKey) {
    return Optional.ofNullable(mapper.findByIdempotencyKey(idempotencyKey)).map(this::toSession);
  }

  @Override
  public boolean markValidating(UUID id, UUID mediaAssetId) {
    return mapper.markValidating(id, mediaAssetId) == 1;
  }

  @Override
  public boolean markReady(UUID id, UUID mediaAssetId) {
    return mapper.markReady(id, mediaAssetId) == 1;
  }

  @Override
  public boolean markRejected(UUID id) {
    return mapper.markRejected(id) == 1;
  }

  @Override
  @Transactional(readOnly = true)
  public List<ExpiredUpload> findExpiredPending(int limit) {
    if (limit < 1 || limit > 500)
      throw new IllegalArgumentException("limit must be between 1 and 500");
    return mapper.findExpiredPending(limit).stream()
        .map(row -> new ExpiredUpload(row.getId(), row.getStorageKey()))
        .toList();
  }

  @Override
  @Transactional(readOnly = true)
  public List<RejectedUpload> findRejectedForCleanup(int limit) {
    if (limit < 1 || limit > 500)
      throw new IllegalArgumentException("limit must be between 1 and 500");
    return mapper.findRejectedForCleanup(limit).stream()
        .map(row -> new RejectedUpload(row.getId(), row.getStorageKey()))
        .toList();
  }

  private UploadSession toSession(MediaUploadSessionRow row) {
    return new UploadSession(
        row.getId(),
        row.getAssetType(),
        row.getOriginalFilename(),
        row.getContentType(),
        row.getExpectedSize(),
        row.getExpectedSha256(),
        row.getStorageKey(),
        row.getIdempotencyKey(),
        row.getStatus(),
        row.getExpiresAt(),
        row.getCreatedAt(),
        row.getMediaAssetId());
  }

  private static boolean sameCreateRequest(UploadSession session, CreateUploadSession command) {
    return session.assetType().equals(command.assetType())
        && session.originalFilename().equals(command.originalFilename())
        && session.contentType().equals(command.contentType())
        && session.expectedSize() == command.expectedSize()
        && session.expectedSha256().equals(command.expectedSha256());
  }
}
