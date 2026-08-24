package com.narrativex.backend.feature.assets.infrastructure.persistence.adapter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository.CreateUploadSession;
import com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis.MediaUploadSessionMapper;
import com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis.MediaUploadSessionRow;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class MyBatisMediaUploadSessionRepositoryTest {
  private static final String ACCOUNT = "account-a";
  private static final String KEY = "retry-1";
  private static final String SHA = "a".repeat(64);

  @Mock private MediaUploadSessionMapper mapper;

  @Test
  void concurrentIdempotentInsertReturnsWinningSession() {
    CreateUploadSession command = command();
    MediaUploadSessionRow winner = row(command);
    when(mapper.insert(command)).thenReturn(0);
    when(mapper.findByIdempotencyKey(ACCOUNT, KEY)).thenReturn(winner);

    var result = new MyBatisMediaUploadSessionRepository(mapper).create(command);

    assertThat(result.id()).isEqualTo(winner.getId());
    assertThat(result.storageKey()).isEqualTo(winner.getStorageKey());
  }

  @Test
  void concurrentDifferentRequestWithSameKeyIsRejected() {
    CreateUploadSession command = command();
    MediaUploadSessionRow winner = row(command);
    winner.setExpectedSize(command.expectedSize() + 1);
    when(mapper.insert(command)).thenReturn(0);
    when(mapper.findByIdempotencyKey(ACCOUNT, KEY)).thenReturn(winner);

    assertThatThrownBy(() -> new MyBatisMediaUploadSessionRepository(mapper).create(command))
        .isInstanceOf(ResourceConflictException.class)
        .hasMessageContaining("Idempotency key");
  }

  private static CreateUploadSession command() {
    UUID id = UUID.randomUUID();
    return new CreateUploadSession(
        id,
        ACCOUNT,
        "AUDIO",
        "voice.wav",
        "audio/wav",
        128,
        SHA,
        "media/uploads/" + id,
        KEY,
        Instant.now().plusSeconds(900));
  }

  private static MediaUploadSessionRow row(CreateUploadSession command) {
    MediaUploadSessionRow row = new MediaUploadSessionRow();
    row.setId(UUID.randomUUID());
    row.setAssetType(command.assetType());
    row.setOriginalFilename(command.originalFilename());
    row.setContentType(command.contentType());
    row.setExpectedSize(command.expectedSize());
    row.setExpectedSha256(command.expectedSha256());
    row.setStorageKey("media/uploads/" + row.getId());
    row.setIdempotencyKey(command.idempotencyKey());
    row.setStatus("PENDING_UPLOAD");
    row.setExpiresAt(command.expiresAt());
    row.setCreatedAt(Instant.now());
    return row;
  }
}
