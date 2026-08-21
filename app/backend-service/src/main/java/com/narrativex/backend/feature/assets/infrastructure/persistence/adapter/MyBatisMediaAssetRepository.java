package com.narrativex.backend.feature.assets.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.assets.application.pagination.MediaAssetCursor;
import com.narrativex.backend.feature.assets.application.pagination.MediaAssetCursorCodec;
import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.assets.application.query.MediaAssetView;
import com.narrativex.backend.feature.assets.domain.service.MediaAssetTransitionService;
import com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis.MediaAssetMapper;
import com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis.MediaAssetRow;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.assets.domain.enums.MediaAssetStatus;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class MyBatisMediaAssetRepository implements MediaAssetRepository {
  private final MediaAssetMapper mapper;
  private final MediaAssetTransitionService transitionService;

  @Override
  @Transactional(readOnly = true)
  public CursorPage<MediaAssetView> list(
      String accountId, String type, String status, String search, String cursor, int limit) {
    validateLimit(limit);
    MediaAssetCursor key = MediaAssetCursorCodec.decode(cursor);
    List<MediaAssetRow> rows =
        mapper.findPage(
            accountId,
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
  public MediaAssetView create(String accountId, CreateMediaAsset command) {
    MediaAssetRow row =
        new MediaAssetRow(
            command.id(),
            accountId,
            command.type(),
            command.origin(),
            command.storageKey(),
            command.originalFilename(),
            command.contentType(),
            command.sizeBytes(),
            command.sha256(),
            command.durationMs(),
            MediaAssetStatus.PENDING_UPLOAD.name(),
            null,
            null,
            null);
    try {
      UUID insertedId = mapper.insert(row);
      if (insertedId == null) {
        throw new ResourceConflictException("Asset metadata conflicts with an existing asset");
      }
      return requireOwned(accountId, insertedId);
    } catch (DataIntegrityViolationException exception) {
      throw new ResourceConflictException("Asset metadata conflicts with an existing asset");
    }
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
  @Transactional
  public MediaAssetView markReady(String accountId, UUID id) {
    MediaAssetRow current = requireOwnedRow(accountId, id);
    if (statusOf(current) == MediaAssetStatus.READY) return toView(current);
    if (statusOf(current) == MediaAssetStatus.PENDING_UPLOAD) {
      startUpload(accountId, id);
      current = requireOwnedRow(accountId, id);
    }
    if (statusOf(current) == MediaAssetStatus.UPLOADING) {
      startValidation(accountId, id);
    }
    return approve(accountId, id);
  }

  @Override
  @Transactional(readOnly = true)
  public MediaAssetView findOwned(String accountId, UUID id) {
    return toView(requireOwnedRow(accountId, id));
  }

  @Override
  @Transactional
  public MediaAssetView approve(String accountId, UUID id) {
    MediaAssetRow current = requireOwnedRow(accountId, id);
    transitionService.requireAllowed(statusOf(current), MediaAssetStatus.READY);
    try {
      if (mapper.approve(accountId, id) != 1) {
        throw optimisticConflict(id);
      }
      return requireOwned(accountId, id);
    } catch (DataIntegrityViolationException exception) {
      MediaAssetRow existing = mapper.findVerifiedByChecksum(accountId, current.getSha256());
      if (existing != null && !existing.getId().equals(id)) return toView(existing);
      throw exception;
    }
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
  }

  private MediaAssetView transition(
      String accountId,
      UUID id,
      MediaAssetStatus nextStatus,
      TransitionOperation operation) {
    MediaAssetRow current = requireOwnedRow(accountId, id);
    transitionService.requireAllowed(statusOf(current), nextStatus);
    if (operation.update(accountId, id) != 1) {
      throw optimisticConflict(id);
    }
    return requireOwned(accountId, id);
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
        row.getCreatedAt());
  }

  private static ObjectOptimisticLockingFailureException optimisticConflict(UUID id) {
    return new ObjectOptimisticLockingFailureException(MediaAssetView.class, id);
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
