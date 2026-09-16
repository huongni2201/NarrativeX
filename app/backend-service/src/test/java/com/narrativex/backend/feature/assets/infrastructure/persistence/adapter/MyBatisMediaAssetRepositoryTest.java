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
  private static final String HASH = "a".repeat(64);
  private final MediaAssetMapper mapper = org.mockito.Mockito.mock(MediaAssetMapper.class);
  private final MyBatisMediaAssetRepository repository = new MyBatisMediaAssetRepository(mapper);

  @Test
  void cursorPageIsProjectScopedAndReturnsNextCursor() {
    UUID projectId = UUID.randomUUID();
    MediaAssetRow first =
        row(UUID.randomUUID(), projectId, "READY", Instant.parse("2026-01-01T00:00:00Z"));
    MediaAssetRow second =
        row(UUID.randomUUID(), projectId, "READY", Instant.parse("2025-12-31T00:00:00Z"));
    MediaAssetRow third =
        row(UUID.randomUUID(), projectId, "READY", Instant.parse("2025-12-30T00:00:00Z"));
    when(mapper.findPage(eq(projectId), eq(null), eq(null), eq(null), eq(null), eq(null), eq(3)))
        .thenReturn(List.of(first, second, third));

    CursorPage<com.narrativex.backend.feature.assets.application.query.MediaAssetView> page =
        repository.list(projectId, null, null, null, null, 2);

    assertThat(page.content()).extracting("id").containsExactly(first.getId(), second.getId());
    assertThat(page.nextCursor()).isNotBlank();
    assertThat(MediaAssetCursorCodec.decode(page.nextCursor()).id()).isEqualTo(second.getId());
  }

  @Test
  void createLocalAssetPersistsProjectOwnershipWithoutChecksumReuse() {
    UUID projectId = UUID.randomUUID();
    UUID assetId = UUID.randomUUID();
    when(mapper.insertLocal(any())).thenReturn(assetId);
    when(mapper.findById(eq(projectId), any(UUID.class)))
        .thenAnswer(
            invocation ->
                row(
                    invocation.getArgument(1),
                    projectId,
                    "READY",
                    Instant.parse("2026-01-01T00:00:00Z")));

    var view =
        repository.createLocalAsset(
            new MediaAssetRepository.CreateLocalMediaAsset(
                assetId, projectId, "IMAGE", "scene.png", "image/png", 100, HASH, null));

    assertThat(view.id()).isEqualTo(assetId);
    verify(mapper)
        .insertLocal(
            org.mockito.ArgumentMatchers.argThat(
                row ->
                    row.getProjectId().equals(projectId)
                        && row.getSha256().equals(HASH)
                        && "READY".equals(row.getStatus())
                        && "USER_UPLOAD".equals(row.getOrigin())));
  }

  @Test
  void findByIdThrowsWhenMissing() {
    UUID projectId = UUID.randomUUID();
    UUID assetId = UUID.randomUUID();
    when(mapper.findById(projectId, assetId)).thenReturn(null);

    assertThatThrownBy(() -> repository.findById(projectId, assetId))
        .isInstanceOf(ResourceNotFoundException.class);
  }

  @Test
  void deleteDelegatesToMapper() {
    UUID projectId = UUID.randomUUID();
    UUID assetId = UUID.randomUUID();
    when(mapper.findById(projectId, assetId))
        .thenReturn(row(assetId, projectId, "READY", Instant.parse("2026-01-01T00:00:00Z")));
    when(mapper.softDelete(projectId, assetId)).thenReturn(1);

    repository.delete(projectId, assetId);

    verify(mapper).softDelete(projectId, assetId);
  }

  private static MediaAssetRow row(UUID id, UUID projectId, String status, Instant createdAt) {
    return new MediaAssetRow(
        id,
        projectId,
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
  }
}
