package com.narrativex.backend.feature.project.infrastructure.persistence.adapter;

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
  public List<ProjectResourceView.Location> listLocations(Long projectId) {
    return jdbcTemplate.query(
        """
        SELECT id, name, description, visual_prompt, reference_image_url, status, updated_at
          FROM project_locations
         WHERE project_id = ? AND status = 'ACTIVE'
         ORDER BY updated_at DESC, id DESC
        """,
        (rs, rowNum) -> mapLocation(rs),
        projectId);
  }

  @Override
  public List<ProjectResourceView.Asset> listAssets(Long projectId) {
    return jdbcTemplate.query(
        """
        SELECT id, name, asset_type, storage_key, url, mime_type, status,
               metadata_json::text AS metadata_json, updated_at
          FROM project_assets
         WHERE project_id = ? AND status = 'ACTIVE'
         ORDER BY updated_at DESC, id DESC
        """,
        (rs, rowNum) -> mapAsset(rs),
        projectId);
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
