package com.narrativex.backend.feature.assets.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository.CreateUploadSession;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository.UploadSession;
import com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis.MediaUploadSessionMapper;
import com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis.MediaUploadSessionRow;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class MyBatisMediaUploadSessionRepository implements MediaUploadSessionRepository {
  private final MediaUploadSessionMapper mapper;

  @Override
  @Transactional
  public UploadSession create(CreateUploadSession command) {
    mapper.insert(command);
    return findOwned(command.accountId(), command.id())
        .orElseThrow(() -> new IllegalStateException("Upload session disappeared after insert"));
  }

  @Override
  @Transactional
  public Optional<UploadSession> findOwned(String accountId, UUID id) {
    return Optional.ofNullable(mapper.findOwned(accountId, id)).map(this::toSession);
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<UploadSession> findByIdempotencyKey(String accountId, String idempotencyKey) {
    return Optional.ofNullable(mapper.findByIdempotencyKey(accountId, idempotencyKey)).map(this::toSession);
  }

  @Override
  public boolean markReady(String accountId, UUID id, UUID mediaAssetId) {
    return mapper.markReady(accountId, id, mediaAssetId) == 1;
  }

  @Override
  public boolean markRejected(String accountId, UUID id) {
    return mapper.markRejected(accountId, id) == 1;
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
