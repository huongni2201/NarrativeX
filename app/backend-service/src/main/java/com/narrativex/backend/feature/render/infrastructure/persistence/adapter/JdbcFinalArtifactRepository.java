package com.narrativex.backend.feature.render.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.render.application.port.out.FinalArtifactRepository;
import com.narrativex.backend.feature.render.application.query.FinalArtifactView;
import java.sql.ResultSet;
import java.sql.SQLException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class JdbcFinalArtifactRepository implements FinalArtifactRepository {
  private final JdbcTemplate jdbcTemplate;

  @Override
  public FinalArtifactView findOwned(Long artifactId, String ownerId) {
    return jdbcTemplate
        .query(
            "SELECT fa.id, fa.project_id, fa.chapter_id, fa.artifact_type, fa.render_fingerprint, "
                + "fa.storage_key, fa.mime_type, fa.size_bytes, fa.checksum_sha256, fa.duration_ms, "
                + "fa.width, fa.height, fa.status, fa.created_at, fa.updated_at "
                + "FROM final_artifacts fa JOIN projects p ON p.id = fa.project_id "
                + "WHERE fa.id = ? AND p.owner_id = ?",
            this::toView,
            artifactId,
            ownerId)
        .stream()
        .findFirst()
        .orElseThrow(() -> new ResourceNotFoundException("Final artifact not found"));
  }

  private FinalArtifactView toView(ResultSet rs, int rowNum) throws SQLException {
    return new FinalArtifactView(
        rs.getLong("id"),
        rs.getLong("project_id"),
        rs.getObject("chapter_id", Long.class),
        rs.getString("artifact_type"),
        rs.getString("render_fingerprint"),
        rs.getString("storage_key"),
        rs.getString("mime_type"),
        rs.getObject("size_bytes", Long.class),
        rs.getString("checksum_sha256"),
        rs.getObject("duration_ms", Long.class),
        rs.getObject("width", Integer.class),
        rs.getObject("height", Integer.class),
        rs.getString("status"),
        rs.getTimestamp("created_at").toInstant(),
        rs.getTimestamp("updated_at").toInstant());
  }
}
