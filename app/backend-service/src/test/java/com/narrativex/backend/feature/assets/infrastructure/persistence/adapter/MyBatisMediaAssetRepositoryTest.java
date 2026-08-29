package com.narrativex.backend.feature.assets.infrastructure.persistence.adapter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.assets.application.pagination.MediaAssetCursorCodec;
import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.assets.domain.enums.MediaAssetStatus;
import com.narrativex.backend.feature.assets.domain.service.MediaAssetTransitionService;
import com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis.MediaAssetMapper;
import com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis.MediaAssetRow;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class MyBatisMediaAssetRepositoryTest {
  private static final String ACCOUNT = "account-1";
  private static final String HASH = "a".repeat(64);
  private final MediaAssetMapper mapper = org.mockito.Mockito.mock(MediaAssetMapper.class);
  private final MyBatisMediaAssetRepository repository =
      new MyBatisMediaAssetRepository(mapper, new MediaAssetTransitionService());

  private UUID firstId;
  private MediaAssetRow validating;

  @BeforeEach
  void setUp() {
    firstId = UUID.randomUUID();
    validating =
        row(firstId, MediaAssetStatus.VALIDATING.name(), Instant.parse("2026-01-01T00:00:00Z"));
  }

  @Test
  void cursorPageUsesCreatedAtAndUuidTieBreakAndReturnsNextCursor() {
    UUID projectId = UUID.randomUUID();
    MediaAssetRow second = row(UUID.randomUUID(), "READY", Instant.parse("2025-12-31T00:00:00Z"));
    MediaAssetRow third = row(UUID.randomUUID(), "READY", Instant.parse("2025-12-30T00:00:00Z"));
    when(mapper.findPage(
            eq(ACCOUNT),
            eq(projectId),
            eq(null),
            eq(null),
            eq(null),
            eq(null),
            eq(null),
            eq(3)))
        .thenReturn(List.of(validating, second, third));

    CursorPage<com.narrativex.backend.feature.assets.application.query.MediaAssetView> page =
        repository.list(ACCOUNT, projectId, null, null, null, null, 2);

    assertThat(page.content()).extracting("id").containsExactly(firstId, second.getId());
    assertThat(page.nextCursor()).isNotBlank();
    assertThat(MediaAssetCursorCodec.decode(page.nextCursor()).id()).isEqualTo(second.getId());
  }

  @Test
  void checksumClaimReturnsTheCanonicalAssetWhenItAlreadyExists() {
    MediaAssetRow existing = row(UUID.randomUUID(), "READY", Instant.parse("2025-12-01T00:00:00Z"));
    when(mapper.claimChecksum(ACCOUNT, HASH, firstId)).thenReturn(null);
    when(mapper.findCanonicalAssetId(ACCOUNT, HASH)).thenReturn(existing.getId());
    when(mapper.findOwned(ACCOUNT, existing.getId())).thenReturn(existing);

    assertThat(
            repository
                .createOrReuseVerifiedAsset(
                    ACCOUNT,
                    new MediaAssetRepository.CreateVerifiedMediaAsset(
                        firstId,
                        "AUDIO",
                        "USER_UPLOAD",
                        "media/new",
                        "voice.wav",
                        "audio/wav",
                        100,
                        HASH,
                        1_000L))
                .id())
        .isEqualTo(existing.getId());
    verify(mapper, never()).insertVerified(any());
  }

  @Test
  void checksumClaimMaterializesOneValidatingCandidate() {
    when(mapper.claimChecksum(ACCOUNT, HASH, firstId)).thenReturn(firstId);
    when(mapper.insertVerified(any())).thenReturn(firstId);
    when(mapper.findOwned(ACCOUNT, firstId)).thenReturn(validating);

    assertThat(
            repository
                .createOrReuseVerifiedAsset(
                    ACCOUNT,
                    new MediaAssetRepository.CreateVerifiedMediaAsset(
                        firstId,
                        "AUDIO",
                        "USER_UPLOAD",
                        "media/new",
                        "voice.wav",
                        "audio/wav",
                        100,
                        HASH,
                        1_000L))
                .id())
        .isEqualTo(firstId);
    verify(mapper).insertVerified(any());
  }

  @Test
  void deletedOrForeignAssetIsNotVisibleToOwnedFind() {
    when(mapper.findOwned(ACCOUNT, firstId)).thenReturn(null);

    assertThatThrownBy(() -> repository.findOwned(ACCOUNT, firstId))
        .isInstanceOf(ResourceNotFoundException.class);
  }

  @Test
  void softDeleteUsesTheGuardedRepositoryOperation() {
    MediaAssetRow ready = row(firstId, "READY", Instant.parse("2026-01-01T00:00:00Z"));
    when(mapper.findOwned(ACCOUNT, firstId)).thenReturn(ready);
    when(mapper.softDelete(ACCOUNT, firstId)).thenReturn(1);

    repository.delete(ACCOUNT, firstId);

    verify(mapper).softDelete(ACCOUNT, firstId);
  }

  private static MediaAssetRow row(UUID id, String status, Instant createdAt) {
    return new MediaAssetRow(
        id,
        ACCOUNT,
        "AUDIO",
        "USER_UPLOAD",
        "media/" + id,
        "voice.wav",
        "audio/wav",
        100,
        HASH,
        1_000L,
        status,
        createdAt,
        null,
        "READY".equals(status) ? createdAt : null);
  }
}
