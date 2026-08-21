package com.narrativex.backend.feature.assets.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.assets.application.query.MediaAssetView;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class JdbcMediaAssetRepository implements MediaAssetRepository {
  private final JdbcTemplate jdbcTemplate;

  @Override
  public List<MediaAssetView> list(String accountId, String type, String status, String search) {
    StringBuilder sql =
        new StringBuilder(
            "SELECT id, asset_type, origin, storage_key, original_filename, content_type, "
                + "size_bytes, sha256, duration_ms, status, created_at FROM media_assets "
                + "WHERE account_id = ?");
    List<Object> args = new java.util.ArrayList<>(List.of(accountId));
    addEquals(sql, args, "asset_type", type);
    addEquals(sql, args, "status", status);
    if (search != null && !search.isBlank()) {
      sql.append(" AND (LOWER(original_filename) LIKE LOWER(?) OR LOWER(storage_key) LIKE LOWER(?))");
      String pattern = "%" + search.trim() + "%";
      args.add(pattern);
      args.add(pattern);
    }
    sql.append(" ORDER BY created_at DESC, id DESC");
    return jdbcTemplate.query(sql.toString(), this::toView, args.toArray());
  }

  @Override
  public MediaAssetView create(String accountId, CreateMediaAsset command) {
    try {
      jdbcTemplate.update(
          "INSERT INTO media_assets "
              + "(id, account_id, asset_type, origin, storage_key, original_filename, content_type, "
              + "size_bytes, sha256, duration_ms, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_UPLOAD')",
          command.id(),
          accountId,
          command.type(),
          command.origin(),
          command.storageKey(),
          command.originalFilename(),
          command.contentType(),
          command.sizeBytes(),
          command.sha256(),
          command.durationMs());
      return findOwned(accountId, command.id());
    } catch (DataIntegrityViolationException exception) {
      throw new IllegalArgumentException("Asset metadata conflicts with an existing asset", exception);
    }
  }

  @Override
  public MediaAssetView approve(String accountId, UUID id) {
    int updated =
        jdbcTemplate.update(
            "UPDATE media_assets SET status = 'READY' "
                + "WHERE id = ? AND account_id = ? AND status IN ('UPLOADED', 'VALIDATING')",
            id,
            accountId);
    if (updated == 0) {
      throw new IllegalStateException("Only uploaded or validating assets can be approved");
    }
    return findOwned(accountId, id);
  }

  @Override
  public void delete(String accountId, UUID id) {
    int updated =
        jdbcTemplate.update(
            "DELETE FROM media_assets m WHERE m.id = ? AND m.account_id = ? "
                + "AND NOT EXISTS (SELECT 1 FROM narration_parts p WHERE p.media_asset_id = m.id)",
            id,
            accountId);
    if (updated == 0) {
      throw new IllegalStateException("Asset not found or already referenced by narration");
    }
  }

  private MediaAssetView findOwned(String accountId, UUID id) {
    List<MediaAssetView> rows =
        jdbcTemplate.query(
            "SELECT id, asset_type, origin, storage_key, original_filename, content_type, "
                + "size_bytes, sha256, duration_ms, status, created_at FROM media_assets "
                + "WHERE id = ? AND account_id = ?",
            this::toView,
            id,
            accountId);
    if (rows.isEmpty()) throw new ResourceNotFoundException("Asset not found");
    return rows.getFirst();
  }

  private static void addEquals(StringBuilder sql, List<Object> args, String column, String value) {
    if (value != null && !value.isBlank()) {
      sql.append(" AND ").append(column).append(" = ?");
      args.add(value.trim().toUpperCase());
    }
  }

  private MediaAssetView toView(ResultSet rs, int rowNum) throws SQLException {
    return new MediaAssetView(
        rs.getObject("id", UUID.class),
        rs.getString("asset_type"),
        rs.getString("origin"),
        rs.getString("storage_key"),
        rs.getString("original_filename"),
        rs.getString("content_type"),
        rs.getLong("size_bytes"),
        rs.getString("sha256"),
        rs.getObject("duration_ms", Long.class),
        rs.getString("status"),
        rs.getTimestamp("created_at").toInstant());
  }
}
