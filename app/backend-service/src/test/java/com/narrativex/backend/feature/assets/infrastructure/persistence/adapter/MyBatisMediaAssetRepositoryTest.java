package com.narrativex.backend.feature.assets.infrastructure.persistence.adapter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.assets.application.pagination.MediaAssetCursorCodec;
import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis.MediaAssetMapper;
import com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis.MediaAssetRow;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MyBatisMediaAssetRepositoryTest {
  private static final String ACCOUNT = "account-1";
  private static final String HASH = "a".repeat(64);
  private final MediaAssetMapper mapper = org.mockito.Mockito.mock(MediaAssetMapper.class);
  private final MyBatisMediaAssetRepository repository = new MyBatisMediaAssetRepository(mapper);

  @Test
  void cursorPageIsProjectScopedAndReturnsNextCursor() {
    UUID projectId = UUID.randomUUID();
    MediaAssetRow first = row(UUID.randomUUID(), projectId, "READY", Instant.parse("2026-01-01T00:00:00Z"));
    MediaAssetRow second = row(UUID.randomUUID(), projectId, "READY", Instant.parse("2025-12-31T00:00:00Z"));
    MediaAssetRow third = row(UUID.randomUUID(), projectId, "READY", Instant.parse("2025-12-30T00:00:00Z"));
    when(mapper.findPage(eq(ACCOUNT), eq(projectId), eq(null), eq(null), eq(null), eq(null), eq(null), eq(3)))
        .thenReturn(List.of(first, second, third));

    CursorPage<com.narrativex.backend.feature.assets.application.query.MediaAssetView> page =
        repository.list(ACCOUNT, projectId, null, null, null, null, 2);

    assertThat(page.content()).extracting("id").containsExactly(first.getId(), second.getId());
    assertThat(page.nextCursor()).isNotBlank();
    assertThat(MediaAssetCursorCodec.decode(page.nextCursor()).id()).isEqualTo(second.getId());
  }

  @Test
  void createLocalAssetPersistsProjectOwnershipWithoutChecksumReuse() {
    UUID projectId = UUID.randomUUID();
    UUID assetId = UUID.randomUUID();
    when(mapper.insertLocal(any())).thenReturn(assetId);
    when(mapper.findOwned(eq(ACCOUNT), eq(projectId), any(UUID.class)))
        .thenAnswer(
            invocation ->
                row(
                    invocation.getArgument(2),
                    projectId,
                    "READY",
                    Instant.parse("2026-01-01T00:00:00Z")));

    var created =
        repository.createLocalAsset(
            ACCOUNT,
            new MediaAssetRepository.CreateLocalMediaAsset(
                assetId, projectId, "IMAGE", "scene.png", "image/png", 100, HASH, null));

    assertThat(created.id()).isEqualTo(assetId);
    verify(mapper).insertLocal(any());
    verify(mapper).findOwned(ACCOUNT, projectId, assetId);
  }

  @Test
  void assetFromAnotherProjectIsNotVisibleToOwnedFind() {
    UUID projectId = UUID.randomUUID();
    UUID assetId = UUID.randomUUID();
    when(mapper.findOwned(ACCOUNT, projectId, assetId)).thenReturn(null);

    assertThatThrownBy(() -> repository.findOwned(ACCOUNT, projectId, assetId))
        .isInstanceOf(ResourceNotFoundException.class);
  }

  @Test
  void softDeleteUsesAccountAndProjectGuards() {
    UUID projectId = UUID.randomUUID();
    UUID assetId = UUID.randomUUID();
    MediaAssetRow ready = row(assetId, projectId, "READY", Instant.parse("2026-01-01T00:00:00Z"));
    when(mapper.findOwned(ACCOUNT, projectId, assetId)).thenReturn(ready);
    when(mapper.softDelete(ACCOUNT, projectId, assetId)).thenReturn(1);

    repository.delete(ACCOUNT, projectId, assetId);

    verify(mapper).softDelete(ACCOUNT, projectId, assetId);
  }

  private static MediaAssetRow row(UUID id, UUID projectId, String status, Instant createdAt) {
    MediaAssetRow row =
        new MediaAssetRow(
            id,
            ACCOUNT,
            "IMAGE",
            "PROJECT_ASSET",
            null,
            "scene.png",
            "image/png",
            100,
            HASH,
            null,
            status,
            createdAt,
            null,
            "READY".equals(status) ? createdAt : null);
    row.setProjectId(projectId);
    return row;
  }
}
