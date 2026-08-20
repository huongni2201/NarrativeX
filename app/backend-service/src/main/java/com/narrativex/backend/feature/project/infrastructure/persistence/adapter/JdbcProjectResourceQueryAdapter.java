package com.narrativex.backend.feature.project.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.pagination.CursorCodec;
import com.narrativex.backend.feature.common.pagination.CursorKey;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.project.application.port.out.ProjectResourceQueryRepository;
import com.narrativex.backend.feature.project.application.query.ProjectResourceView;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class JdbcProjectResourceQueryAdapter implements ProjectResourceQueryRepository {
  private final JdbcTemplate jdbcTemplate;

  @Override
  public CursorPage<ProjectResourceView.Location> listLocations(
      Long projectId, String cursor, int limit) {
    CursorKey cursorKey = CursorCodec.decode(cursor);
    List<ProjectResourceView.Location> entities;
    if (cursorKey == null) {
      entities =
          jdbcTemplate.query(
              """
              SELECT id, name, description, visual_prompt, reference_image_url, status, updated_at
                FROM project_locations
               WHERE project_id = ? AND status = 'ACTIVE'
               ORDER BY updated_at DESC, id DESC
               LIMIT ?
              """,
              (rs, rowNum) -> mapLocation(rs),
              projectId,
              limit + 1);
    } else {
      entities =
          jdbcTemplate.query(
              """
              SELECT id, name, description, visual_prompt, reference_image_url, status, updated_at
                FROM project_locations
               WHERE project_id = ? AND status = 'ACTIVE'
                 AND (updated_at < ? OR (updated_at = ? AND id < ?))
               ORDER BY updated_at DESC, id DESC
               LIMIT ?
              """,
              (rs, rowNum) -> mapLocation(rs),
              projectId,
              Timestamp.from(cursorKey.updatedAt()),
              Timestamp.from(cursorKey.updatedAt()),
              cursorKey.id(),
              limit + 1);
    }

    boolean hasNext = entities.size() > limit;
    List<ProjectResourceView.Location> visibleEntities =
        entities.subList(0, Math.min(limit, entities.size()));
    String nextCursor =
        hasNext && !visibleEntities.isEmpty()
            ? CursorCodec.encode(
                visibleEntities.getLast().updatedAt(), visibleEntities.getLast().id())
            : null;

    return new CursorPage<>(visibleEntities, nextCursor, limit, hasNext);
  }

  @Override
  public CursorPage<ProjectResourceView.Asset> listAssets(
      Long projectId, String cursor, int limit) {
    CursorKey cursorKey = CursorCodec.decode(cursor);
    List<ProjectResourceView.Asset> entities;
    if (cursorKey == null) {
      entities =
          jdbcTemplate.query(
              """
              SELECT id, name, asset_type, storage_key, url, mime_type, status,
                     metadata_json::text AS metadata_json, updated_at
                FROM project_assets
               WHERE project_id = ? AND status = 'ACTIVE'
               ORDER BY updated_at DESC, id DESC
               LIMIT ?
              """,
              (rs, rowNum) -> mapAsset(rs),
              projectId,
              limit + 1);
    } else {
      entities =
          jdbcTemplate.query(
              """
              SELECT id, name, asset_type, storage_key, url, mime_type, status,
                     metadata_json::text AS metadata_json, updated_at
                FROM project_assets
               WHERE project_id = ? AND status = 'ACTIVE'
                 AND (updated_at < ? OR (updated_at = ? AND id < ?))
               ORDER BY updated_at DESC, id DESC
               LIMIT ?
              """,
              (rs, rowNum) -> mapAsset(rs),
              projectId,
              Timestamp.from(cursorKey.updatedAt()),
              Timestamp.from(cursorKey.updatedAt()),
              cursorKey.id(),
              limit + 1);
    }

    boolean hasNext = entities.size() > limit;
    List<ProjectResourceView.Asset> visibleEntities =
        entities.subList(0, Math.min(limit, entities.size()));
    String nextCursor =
        hasNext && !visibleEntities.isEmpty()
            ? CursorCodec.encode(
                visibleEntities.getLast().updatedAt(), visibleEntities.getLast().id())
            : null;

    return new CursorPage<>(visibleEntities, nextCursor, limit, hasNext);
  }

  private static ProjectResourceView.Location mapLocation(ResultSet rs) throws SQLException {
    return new ProjectResourceView.Location(
        rs.getLong("id"),
        rs.getString("name"),
        rs.getString("description"),
        rs.getString("visual_prompt"),
        rs.getString("reference_image_url"),
        rs.getString("status"),
        instant(rs, "updated_at"));
  }

  private static ProjectResourceView.Asset mapAsset(ResultSet rs) throws SQLException {
    return new ProjectResourceView.Asset(
        rs.getLong("id"),
        rs.getString("name"),
        rs.getString("asset_type"),
        rs.getString("storage_key"),
        rs.getString("url"),
        rs.getString("mime_type"),
        rs.getString("status"),
        rs.getString("metadata_json"),
        instant(rs, "updated_at"));
  }

  private static Instant instant(ResultSet rs, String column) throws SQLException {
    Timestamp timestamp = rs.getTimestamp(column);
    return timestamp == null ? null : timestamp.toInstant();
  }
}
