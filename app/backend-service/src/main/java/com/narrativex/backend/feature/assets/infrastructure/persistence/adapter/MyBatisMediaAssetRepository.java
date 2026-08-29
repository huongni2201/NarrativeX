package com.narrativex.backend.feature.assets.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.assets.application.pagination.MediaAssetCursor;
import com.narrativex.backend.feature.assets.application.pagination.MediaAssetCursorCodec;
import com.narrativex.backend.feature.assets.application.port.in.MediaAssetAccess;
import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.assets.application.query.MediaAssetView;
import com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis.MediaAssetMapper;
import com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis.MediaAssetRow;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class MyBatisMediaAssetRepository implements MediaAssetRepository, MediaAssetAccess {
  private final MediaAssetMapper mapper;

  @Override
  @Transactional(readOnly = true)
  public CursorPage<MediaAssetView> list(
      String accountId,
      UUID projectId,
      String type,
      String status,
      String search,
      String cursor,
      int limit) {
    validateLimit(limit);
    MediaAssetCursor key = MediaAssetCursorCodec.decode(cursor);
    List<MediaAssetRow> rows =
        mapper.findPage(
            accountId,
            projectId,
            normalizeOptional(type),
            normalizeOptional(status),
            normalizeOptional(search),
            key == null ? null : key.createdAt(),
            key == null ? null : key.id(),
            limit + 1);
    boolean hasNext = rows.size() > limit;
    List<MediaAssetRow> visibleRows = rows.subList(0, Math.min(limit, rows.size()));
    String nextCursor =
        hasNext && !visibleRows.isEmpty()
            ? MediaAssetCursorCodec.encode(
                new MediaAssetCursor(
                    visibleRows.getLast().getCreatedAt(), visibleRows.getLast().getId()))
            : null;
    return new CursorPage<>(
        visibleRows.stream().map(MyBatisMediaAssetRepository::toView).toList(),
        nextCursor,
        limit,
        hasNext);
  }

  @Override
  @Transactional
  public MediaAssetView createLocalAsset(String accountId, CreateLocalMediaAsset command) {
    if (!List.of("AUDIO", "IMAGE", "VIDEO").contains(command.type())) {
      throw new IllegalArgumentException("Project asset type must be AUDIO, IMAGE, or VIDEO");
    }
    if (command.projectId() == null) {
      throw new IllegalArgumentException("Project asset requires projectId");
    }
    if (command.sizeBytes() <= 0
        || command.sha256() == null
        || !command.sha256().matches("^[0-9a-fA-F]{64}$")) {
      throw new IllegalArgumentException("Project asset size and SHA-256 are invalid");
    }
    MediaAssetRow row = new MediaAssetRow();
    row.setId(command.proposedId() == null ? UUID.randomUUID() : command.proposedId());
    row.setAccountId(accountId);
    row.setProjectId(command.projectId());
    row.setAssetType(command.type());
    row.setOriginalFilename(command.originalFilename());
    row.setContentType(command.contentType());
    row.setSizeBytes(command.sizeBytes());
    row.setSha256(command.sha256().toLowerCase(Locale.ROOT));
    row.setDurationMs(command.durationMs());
    mapper.insertLocal(row);
    return requireOwned(accountId, command.projectId(), row.getId());
  }

  @Override
  @Transactional(readOnly = true)
  public MediaAssetView findOwned(String accountId, UUID projectId, UUID id) {
    return toView(requireOwnedRow(accountId, projectId, id));
  }

  @Override
  @Transactional
  public void delete(String accountId, UUID projectId, UUID id) {
    requireOwnedRow(accountId, projectId, id);
    if (mapper.softDelete(accountId, projectId, id) != 1) {
      throw new OptimisticLockingFailureException(
          "Media asset " + id + " was modified concurrently or is still referenced");
    }
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<MediaAssetSummary> findOwnedSummary(String ownerId, UUID assetId) {
    MediaAssetRow row = mapper.findOwnedByAccount(ownerId, assetId);
    if (row == null) return Optional.empty();
    return Optional.of(
        new MediaAssetSummary(
            row.getId(),
            row.getAssetType(),
            row.getStatus(),
            row.getContentType(),
            row.getDetectedContentType()));
  }

  private MediaAssetRow requireOwnedRow(String accountId, UUID projectId, UUID id) {
    MediaAssetRow row = mapper.findOwned(accountId, projectId, id);
    if (row == null) throw new ResourceNotFoundException("Project asset not found");
    return row;
  }

  private MediaAssetView requireOwned(String accountId, UUID projectId, UUID id) {
    return toView(requireOwnedRow(accountId, projectId, id));
  }

  private static MediaAssetView toView(MediaAssetRow row) {
    return new MediaAssetView(
        row.getId(),
        row.getAssetType(),
        row.getOrigin(),
        row.getStorageKey(),
        row.getOriginalFilename(),
        row.getContentType(),
        row.getSizeBytes(),
        row.getSha256(),
        row.getDurationMs(),
        row.getStatus(),
        row.getCreatedAt(),
        row.getDetectedContentType(),
        row.getDetectedContainer(),
        row.getDetectedCodec(),
        row.getWidth(),
        row.getHeight(),
        row.getValidationErrorCode(),
        row.getValidationErrorDetail(),
        row.getValidatedAt());
  }

  private static String normalizeOptional(String value) {
    return value == null || value.isBlank() ? null : value.trim().toUpperCase(Locale.ROOT);
  }

  private static void validateLimit(int limit) {
    if (limit < 1 || limit > 100) {
      throw new IllegalArgumentException("limit must be between 1 and 100");
    }
  }
}
