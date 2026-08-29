package com.narrativex.backend.feature.assets.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.assets.application.pagination.MediaAssetCursor;
import com.narrativex.backend.feature.assets.application.pagination.MediaAssetCursorCodec;
import com.narrativex.backend.feature.assets.application.port.in.MediaAssetAccess;
import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository.CreateVerifiedMediaAsset;
import com.narrativex.backend.feature.assets.application.query.MediaAssetView;
import com.narrativex.backend.feature.assets.domain.enums.MediaAssetStatus;
import com.narrativex.backend.feature.assets.domain.service.MediaAssetTransitionService;
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
  private final MediaAssetTransitionService transitionService;

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
  public MediaAssetView createOrReuseVerifiedAsset(
      String accountId, CreateVerifiedMediaAsset command) {
    String sha256 = command.sha256().toLowerCase(Locale.ROOT);
    UUID canonicalId = mapper.claimChecksum(accountId, sha256, command.proposedId());
    if (canonicalId == null) {
      canonicalId = mapper.findCanonicalAssetId(accountId, sha256);
    }
    if (canonicalId == null) {
      throw new IllegalStateException("Checksum claim disappeared before asset materialization");
    }

    if (canonicalId.equals(command.proposedId())) {
      MediaAssetRow row =
          new MediaAssetRow(
              command.proposedId(),
              accountId,
              command.type(),
              command.origin(),
              command.storageKey(),
              command.originalFilename(),
              command.contentType(),
              command.sizeBytes(),
              sha256,
              command.durationMs(),
              MediaAssetStatus.VALIDATING.name(),
              null,
              null,
              null);
      UUID insertedId = mapper.insertVerified(row);
      if (insertedId == null || !insertedId.equals(canonicalId)) {
        throw new IllegalStateException("Canonical checksum claim was not materialized");
      }
    }
    return requireOwned(accountId, canonicalId);
  }

  @Override
  @Transactional
  public MediaAssetView createLocalAsset(String accountId, CreateLocalMediaAsset command) {
    if (!List.of("AUDIO", "IMAGE", "VIDEO").contains(command.type())) {
      throw new IllegalArgumentException("Local asset type must be AUDIO, IMAGE, or VIDEO");
    }
    if (command.projectId() == null) {
      throw new IllegalArgumentException("Local project asset requires projectId");
    }
    if (command.sizeBytes() <= 0
        || command.sha256() == null
        || !command.sha256().matches("^[0-9a-fA-F]{64}$")) {
      throw new IllegalArgumentException("Local asset size and SHA-256 are invalid");
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
    return requireOwned(accountId, row.getId());
  }

  @Override
  @Transactional
  public MediaAssetView startUpload(String accountId, UUID id) {
    return transition(accountId, id, MediaAssetStatus.UPLOADING, mapper::markUploading);
  }

  @Override
  @Transactional
  public MediaAssetView startValidation(String accountId, UUID id) {
    return transition(accountId, id, MediaAssetStatus.VALIDATING, mapper::markValidating);
  }

  @Override
  @Transactional(readOnly = true)
  public MediaAssetView findOwned(String accountId, UUID id) {
    return toView(requireOwnedRow(accountId, id));
  }

  @Override
  @Transactional(readOnly = true)
  public MediaAssetView findVerifiedByChecksum(String accountId, String sha256) {
    MediaAssetRow row = mapper.findVerifiedByChecksum(accountId, sha256);
    return row == null ? null : toView(row);
  }

  @Override
  @Transactional(readOnly = true)
  public boolean isReferencedByReadyAsset(String storageKey) {
    return mapper.isReferencedByReadyAsset(storageKey);
  }

  @Override
  @Transactional
  public MediaAssetView reject(String accountId, UUID id) {
    return transition(accountId, id, MediaAssetStatus.REJECTED, mapper::reject);
  }

  @Override
  @Transactional
  public void delete(String accountId, UUID id) {
    MediaAssetRow current = requireOwnedRow(accountId, id);
    transitionService.requireAllowed(statusOf(current), MediaAssetStatus.DELETED);
    if (mapper.softDelete(accountId, id) != 1) {
      throw optimisticConflict(id);
    }
    mapper.releaseChecksum(accountId, id);
  }

  private MediaAssetView transition(
      String accountId, UUID id, MediaAssetStatus nextStatus, TransitionOperation operation) {
    MediaAssetRow current = requireOwnedRow(accountId, id);
    transitionService.requireAllowed(statusOf(current), nextStatus);
    if (operation.update(accountId, id) != 1) {
      throw optimisticConflict(id);
    }
    return requireOwned(accountId, id);
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<MediaAssetSummary> findOwnedSummary(String ownerId, UUID assetId) {
    MediaAssetRow row = mapper.findOwned(ownerId, assetId);
    if (row == null) return Optional.empty();
    return Optional.of(
        new MediaAssetSummary(
            row.getId(),
            row.getAssetType(),
            row.getStatus(),
            row.getContentType(),
            row.getDetectedContentType()));
  }

  private MediaAssetRow requireOwnedRow(String accountId, UUID id) {
    MediaAssetRow row = mapper.findOwned(accountId, id);
    if (row == null) throw new ResourceNotFoundException("Asset not found");
    return row;
  }

  private MediaAssetView requireOwned(String accountId, UUID id) {
    return toView(requireOwnedRow(accountId, id));
  }

  private static MediaAssetStatus statusOf(MediaAssetRow row) {
    return MediaAssetStatus.valueOf(row.getStatus());
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

  private static OptimisticLockingFailureException optimisticConflict(UUID id) {
    return new OptimisticLockingFailureException(
        "Media asset " + id + " was modified concurrently");
  }

  private static String normalizeOptional(String value) {
    return value == null || value.isBlank() ? null : value.trim().toUpperCase();
  }

  private static void validateLimit(int limit) {
    if (limit < 1 || limit > 100) {
      throw new IllegalArgumentException("limit must be between 1 and 100");
    }
  }

  @FunctionalInterface
  private interface TransitionOperation {
    int update(String accountId, UUID id);
  }
}
