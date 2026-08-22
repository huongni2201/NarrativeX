package com.narrativex.backend.feature.assets.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository.CreateUploadSession;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository.UploadSession;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository.ExpiredUpload;
import com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis.MediaUploadSessionMapper;
import com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis.MediaUploadSessionRow;
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
    mapper.insert(command);
    return findOwnedSnapshot(command.accountId(), command.id())
        .orElseThrow(() -> new IllegalStateException("Upload session disappeared after insert"));
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<UploadSession> findOwnedSnapshot(String accountId, UUID id) {
    return Optional.ofNullable(mapper.findOwnedSnapshot(accountId, id)).map(this::toSession);
  }

  @Override
  @Transactional(propagation = Propagation.MANDATORY)
  public Optional<UploadSession> findOwnedForUpdate(String accountId, UUID id) {
    return Optional.ofNullable(mapper.findOwnedForUpdate(accountId, id)).map(this::toSession);
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<UploadSession> findByIdempotencyKey(String accountId, String idempotencyKey) {
    return Optional.ofNullable(mapper.findByIdempotencyKey(accountId, idempotencyKey)).map(this::toSession);
  }

  @Override
  public boolean markValidating(String accountId, UUID id, UUID mediaAssetId) {
    return mapper.markValidating(accountId, id, mediaAssetId) == 1;
  }

  @Override
  public boolean markRejected(String accountId, UUID id) {
    return mapper.markRejected(accountId, id) == 1;
  }

  @Override
  @Transactional(readOnly = true)
  public List<ExpiredUpload> findExpiredPending(int limit) {
    if (limit < 1 || limit > 500) throw new IllegalArgumentException("limit must be between 1 and 500");
    return mapper.findExpiredPending(limit).stream()
        .map(row -> new ExpiredUpload(row.getId(), row.getAccountId(), row.getStorageKey()))
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
}
