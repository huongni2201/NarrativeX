package com.narrativex.backend.feature.assets.infrastructure.persistence.adapter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.assets.application.pagination.MediaAssetCursorCodec;
import com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis.MediaAssetMapper;
import com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis.MediaAssetRow;
import com.narrativex.backend.feature.assets.domain.service.MediaAssetTransitionService;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.assets.domain.enums.MediaAssetStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

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
    validating = row(firstId, MediaAssetStatus.VALIDATING.name(), Instant.parse("2026-01-01T00:00:00Z"));
  }

  @Test
  void cursorPageUsesCreatedAtAndUuidTieBreakAndReturnsNextCursor() {
    MediaAssetRow second = row(UUID.randomUUID(), "READY", Instant.parse("2025-12-31T00:00:00Z"));
    MediaAssetRow third = row(UUID.randomUUID(), "READY", Instant.parse("2025-12-30T00:00:00Z"));
    when(mapper.findPage(eq(ACCOUNT), eq(null), eq(null), eq(null), eq(null), eq(null), eq(3)))
        .thenReturn(List.of(validating, second, third));

    CursorPage<com.narrativex.backend.feature.assets.application.query.MediaAssetView> page =
        repository.list(ACCOUNT, null, null, null, null, 2);

    assertThat(page.content()).extracting("id").containsExactly(firstId, second.getId());
    assertThat(page.nextCursor()).isNotBlank();
    assertThat(MediaAssetCursorCodec.decode(page.nextCursor()).id()).isEqualTo(second.getId());
  }

  @Test
  void concurrentApproveOnTheSameAssetIsAnOptimisticConflict() {
    when(mapper.findOwned(ACCOUNT, firstId)).thenReturn(validating);
    when(mapper.approve(ACCOUNT, firstId)).thenReturn(0);

    assertThatThrownBy(() -> repository.approve(ACCOUNT, firstId))
        .isInstanceOf(ObjectOptimisticLockingFailureException.class);
  }

  @Test
  void checksumUniqueConflictReturnsTheAlreadyVerifiedAsset() {
    MediaAssetRow existing = row(UUID.randomUUID(), "READY", Instant.parse("2025-12-01T00:00:00Z"));
    when(mapper.findOwned(ACCOUNT, firstId)).thenReturn(validating);
    when(mapper.approve(ACCOUNT, firstId)).thenThrow(new DuplicateKeyException("checksum"));
    when(mapper.findVerifiedByChecksum(ACCOUNT, HASH)).thenReturn(existing);

    assertThat(repository.approve(ACCOUNT, firstId).id()).isEqualTo(existing.getId());
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
