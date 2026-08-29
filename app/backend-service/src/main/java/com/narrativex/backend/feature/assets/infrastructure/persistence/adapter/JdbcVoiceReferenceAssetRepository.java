package com.narrativex.backend.feature.assets.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.assets.application.port.out.VoiceReferenceAssetRepository;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
@RequiredArgsConstructor
public class JdbcVoiceReferenceAssetRepository implements VoiceReferenceAssetRepository {
  private final JdbcTemplate jdbcTemplate;

  @Override
  @Transactional
  public VoiceReferenceAsset createOrReuse(String accountId, CreateVoiceReference command) {
    String checksum = command.sha256().toLowerCase(java.util.Locale.ROOT);
    Optional<VoiceReferenceAsset> existing = findByChecksum(accountId, checksum);
    if (existing.isPresent()) return existing.get();

    jdbcTemplate.update(
        """
        INSERT INTO voice_reference_assets
          (id, account_id, storage_key, original_filename, content_type, size_bytes, sha256, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'VALIDATING')
        ON CONFLICT (account_id, sha256) DO NOTHING
        """,
        command.proposedId(),
        accountId,
        command.storageKey(),
        command.originalFilename(),
        command.contentType(),
        command.sizeBytes(),
        checksum);

    return findByChecksum(accountId, checksum)
        .orElseThrow(() -> new IllegalStateException("Voice reference checksum claim disappeared"));
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<VoiceReferenceAsset> findOwned(String accountId, UUID id) {
    return jdbcTemplate
        .query(
            """
            SELECT id, storage_key, original_filename, content_type, size_bytes, sha256, status
              FROM voice_reference_assets
             WHERE account_id = ? AND id = ? AND status <> 'DELETED'
            """,
            JdbcVoiceReferenceAssetRepository::map,
            accountId,
            id)
        .stream()
        .findFirst();
  }

  @Override
  @Transactional(readOnly = true)
  public List<VoiceReferenceAsset> listOwned(String accountId) {
    return jdbcTemplate.query(
        """
        SELECT id, storage_key, original_filename, content_type, size_bytes, sha256, status
          FROM voice_reference_assets
         WHERE account_id = ? AND status <> 'DELETED'
         ORDER BY created_at DESC, id DESC
        """,
        JdbcVoiceReferenceAssetRepository::map,
        accountId);
  }

  @Override
  @Transactional(readOnly = true)
  public boolean isReferencedByReadyAsset(String storageKey) {
    Boolean referenced =
        jdbcTemplate.queryForObject(
            """
            SELECT EXISTS (
              SELECT 1 FROM voice_reference_assets
               WHERE storage_key = ? AND status = 'READY'
            )
            """,
            Boolean.class,
            storageKey);
    return Boolean.TRUE.equals(referenced);
  }

  private Optional<VoiceReferenceAsset> findByChecksum(String accountId, String sha256) {
    return jdbcTemplate
        .query(
            """
            SELECT id, storage_key, original_filename, content_type, size_bytes, sha256, status
              FROM voice_reference_assets
             WHERE account_id = ? AND sha256 = ? AND status <> 'DELETED'
            """,
            JdbcVoiceReferenceAssetRepository::map,
            accountId,
            sha256)
        .stream()
        .findFirst();
  }

  private static VoiceReferenceAsset map(ResultSet rs, int rowNum) throws SQLException {
    return new VoiceReferenceAsset(
        rs.getObject("id", UUID.class),
        rs.getString("storage_key"),
        rs.getString("original_filename"),
        rs.getString("content_type"),
        rs.getLong("size_bytes"),
        rs.getString("sha256"),
        rs.getString("status"));
  }
}
