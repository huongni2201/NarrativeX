package com.narrativex.backend.feature.project.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.pagination.CursorCodec;
import com.narrativex.backend.feature.common.pagination.CursorKey;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.project.application.port.out.ProjectResourceQueryRepository;
import com.narrativex.backend.feature.project.application.query.ProjectResourceView;
import com.narrativex.backend.feature.project.infrastructure.persistence.mybatis.ProjectAssetRow;
import com.narrativex.backend.feature.project.infrastructure.persistence.mybatis.ProjectLocationRow;
import com.narrativex.backend.feature.project.infrastructure.persistence.mybatis.ProjectQueryMapper;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisProjectResourceQueryAdapter implements ProjectResourceQueryRepository {
  private final ProjectQueryMapper mapper;

  @Override
  public CursorPage<ProjectResourceView.Location> listLocations(
      Long projectId, String cursor, int limit) {
    CursorKey key = CursorCodec.decode(cursor);
    int fetchLimit = limit + 1;
    List<ProjectLocationRow> rows =
        key == null
            ? mapper.findActiveLocationsFirstPage(projectId, fetchLimit)
            : mapper.findActiveLocationsAfter(projectId, key.updatedAt(), key.id(), fetchLimit);
    boolean hasNext = rows.size() > limit;
    List<ProjectLocationRow> visibleRows = rows.subList(0, Math.min(limit, rows.size()));
    String nextCursor =
        hasNext && !visibleRows.isEmpty()
            ? CursorCodec.encode(
                visibleRows.getLast().getUpdatedAt(), visibleRows.getLast().getId())
            : null;
    return new CursorPage<>(
        visibleRows.stream().map(this::toLocation).toList(), nextCursor, limit, hasNext);
  }

  @Override
  public CursorPage<ProjectResourceView.Asset> listAssets(
      Long projectId, String cursor, int limit) {
    CursorKey key = CursorCodec.decode(cursor);
    int fetchLimit = limit + 1;
    List<ProjectAssetRow> rows =
        key == null
            ? mapper.findActiveAssetsFirstPage(projectId, fetchLimit)
            : mapper.findActiveAssetsAfter(projectId, key.updatedAt(), key.id(), fetchLimit);
    boolean hasNext = rows.size() > limit;
    List<ProjectAssetRow> visibleRows = rows.subList(0, Math.min(limit, rows.size()));
    String nextCursor =
        hasNext && !visibleRows.isEmpty()
            ? CursorCodec.encode(
                visibleRows.getLast().getUpdatedAt(), visibleRows.getLast().getId())
            : null;
    return new CursorPage<>(
        visibleRows.stream().map(this::toAsset).toList(), nextCursor, limit, hasNext);
  }

  private ProjectResourceView.Location toLocation(ProjectLocationRow row) {
    return new ProjectResourceView.Location(
        row.getId(),
        row.getName(),
        row.getDescription(),
        row.getVisualPrompt(),
        row.getReferenceImageUrl(),
        row.getStatus(),
        row.getUpdatedAt());
  }

  private ProjectResourceView.Asset toAsset(ProjectAssetRow row) {
    return new ProjectResourceView.Asset(
        row.getId(),
        row.getName(),
        row.getAssetType(),
        row.getStorageKey(),
        row.getUrl(),
        row.getMimeType(),
        row.getStatus(),
        row.getMetadataJson(),
        row.getUpdatedAt());
  }
}
