package com.narrativex.backend.feature.assets.application.usecase;

import com.narrativex.backend.feature.assets.application.command.CreateUploadIntentCommand;
import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository.CreateUploadSession;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository.UploadSession;
import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort;
import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort.CreateUpload;
import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort.PresignedUpload;
import com.narrativex.backend.feature.assets.application.query.MediaAssetView;
import com.narrativex.backend.feature.assets.application.query.UploadFinalizeView;
import com.narrativex.backend.feature.assets.application.query.UploadIntentView;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MediaUploadUseCase {
  private static final Duration INTENT_TTL = Duration.ofMinutes(15);
  private static final Map<String, Long> MAX_BYTES_BY_TYPE =
      Map.of("AUDIO", 100L * 1024 * 1024, "IMAGE", 100L * 1024 * 1024, "VIDEO", 1_024L * 1024 * 1024);
  private static final Map<String, Set<String>> CONTENT_TYPES_BY_TYPE =
      Map.of(
          "AUDIO", Set.of("audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg", "audio/mp4", "audio/webm"),
          "IMAGE", Set.of("image/jpeg", "image/png", "image/webp", "image/gif"),
          "VIDEO", Set.of("video/mp4", "video/webm", "video/quicktime"));

  private final CurrentUserId currentUserId;
  private final MediaUploadSessionRepository sessions;
  private final MediaAssetRepository assets;
  private final ObjectStoragePort objectStorage;
  private final Clock clock = Clock.systemUTC();

  @Transactional
  public UploadIntentView createIntent(
      CreateUploadIntentCommand request, String requestedIdempotencyKey) {
    String accountId = currentUserId.get();
    validateRequest(request);
    String idempotencyKey = normalizeIdempotencyKey(requestedIdempotencyKey);
    if (idempotencyKey != null) {
      UploadSession existing =
          sessions.findByIdempotencyKey(accountId, idempotencyKey).orElse(null);
      if (existing != null) {
        if (!sameRequest(existing, request)) {
          throw new ResourceConflictException("Idempotency key was already used for another upload");
        }
        return intentResponse(existing);
      }
    }

    Instant expiresAt = Instant.now(clock).plus(INTENT_TTL);
    UUID id = UUID.randomUUID();
    String storageKey = "media/uploads/" + id;
    UploadSession session =
        sessions.create(
            new CreateUploadSession(
                id,
                accountId,
                request.assetType(),
                request.originalFilename().trim(),
                request.contentType().trim().toLowerCase(),
                request.expectedSizeBytes(),
                request.expectedSha256(),
                storageKey,
                idempotencyKey,
                expiresAt));
    return intentResponse(session);
  }

  public UploadFinalizeView finalizeUpload(UUID id) {
    String accountId = currentUserId.get();
    UploadSession session =
        sessions
            .findOwned(accountId, id)
            .orElseThrow(() -> new ResourceNotFoundException("Upload session not found"));

    if ("READY".equals(session.status())) {
      return new UploadFinalizeView(session.id(), session.status(), session.mediaAssetId());
    }
    if ("REJECTED".equals(session.status())) {
      return new UploadFinalizeView(session.id(), session.status(), null);
    }
    if (session.expiresAt().isBefore(Instant.now(clock))) {
      if (sessions.markRejected(accountId, id)) {
        deleteQuietly(session.storageKey());
      }
      return new UploadFinalizeView(session.id(), "REJECTED", null);
    }

    ObjectStoragePort.StoredObject object;
    try {
      object = objectStorage.head(session.storageKey());
    } catch (ObjectStoragePort.ObjectNotFoundException exception) {
      sessions.markRejected(accountId, id);
      return new UploadFinalizeView(session.id(), "REJECTED", null);
    }

    if (!matches(session, object)) {
      if (sessions.markRejected(accountId, id)) {
        deleteQuietly(session.storageKey());
      }
      return new UploadFinalizeView(session.id(), "REJECTED", null);
    }

    MediaAssetView existing = assets.findVerifiedByChecksum(accountId, object.sha256());
    if (existing != null) {
      if (!sessions.markReady(accountId, id, existing.id())) {
        throw new ResourceConflictException("Upload finalization raced with another request");
      }
      deleteQuietly(session.storageKey());
      return new UploadFinalizeView(session.id(), "READY", existing.id());
    }

    MediaAssetRepository.CreateMediaAsset command =
        new MediaAssetRepository.CreateMediaAsset(
            UUID.randomUUID(),
            session.assetType(),
            "USER_UPLOAD",
            session.storageKey(),
            session.originalFilename(),
            normalizeContentType(object.contentType()),
            object.sizeBytes(),
            object.sha256(),
            null);
    var asset = assets.create(accountId, command);
    assets.markReady(accountId, asset.id());
    if (!sessions.markReady(accountId, id, asset.id())) {
      // Another finalizer won the session transition. Remove only this duplicate
      // metadata row; the shared object may already be referenced by the winner.
      try {
        assets.delete(accountId, asset.id());
      } catch (RuntimeException ignored) {
        // Reconciliation can remove an orphaned duplicate without touching the object.
      }
      throw new ResourceConflictException("Upload finalization raced with another request");
    }
    return new UploadFinalizeView(session.id(), "READY", asset.id());
  }

  private void deleteQuietly(String storageKey) {
    try {
      objectStorage.delete(storageKey);
    } catch (RuntimeException ignored) {
      // Cleanup is retried by the storage reconciliation job; rejection must remain durable.
    }
  }

  private static void validateRequest(CreateUploadIntentCommand request) {
    String type = request.assetType() == null ? "" : request.assetType().trim().toUpperCase(Locale.ROOT);
    String contentType = normalize(request.contentType());
    if (!MAX_BYTES_BY_TYPE.containsKey(type)) {
      throw new IllegalArgumentException("Unsupported asset type");
    }
    if (request.expectedSizeBytes() <= 0 || request.expectedSizeBytes() > MAX_BYTES_BY_TYPE.get(type)) {
      throw new IllegalArgumentException("Upload exceeds the server-authorized size limit");
    }
    if (!CONTENT_TYPES_BY_TYPE.get(type).contains(contentType)) {
      throw new IllegalArgumentException("Content type is not allowed for this asset type");
    }
    String filename = request.originalFilename() == null ? "" : request.originalFilename().trim();
    if (filename.isBlank() || filename.contains("/") || filename.contains("\\") || filename.indexOf('\0') >= 0) {
      throw new IllegalArgumentException("Filename is invalid");
    }
  }

  private static String normalize(String value) {
    return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
  }

  private UploadIntentView intentResponse(UploadSession session) {
    PresignedUpload upload =
        objectStorage.createUpload(
            new CreateUpload(
                session.storageKey(),
                session.contentType(),
                session.expectedSize(),
                session.expectedSha256(),
                session.expiresAt()));
    return new UploadIntentView(
        session.id(),
        session.assetType(),
        session.originalFilename(),
        session.contentType(),
        session.expectedSize(),
        session.expectedSha256(),
        session.storageKey(),
        upload.uploadUrl().toString(),
        upload.requiredHeaders(),
        session.status(),
        session.expiresAt());
  }

  private static boolean sameRequest(UploadSession session, CreateUploadIntentCommand request) {
    return session.assetType().equals(request.assetType())
        && session.originalFilename().equals(request.originalFilename().trim())
        && session.contentType().equals(request.contentType().trim().toLowerCase())
        && session.expectedSize() == request.expectedSizeBytes()
        && session.expectedSha256().equals(request.expectedSha256());
  }

  private static boolean matches(
      UploadSession session, ObjectStoragePort.StoredObject object) {
    return session.expectedSize() == object.sizeBytes()
        && normalizeContentType(session.contentType())
            .equals(normalizeContentType(object.contentType()))
        && session.expectedSha256().equalsIgnoreCase(object.sha256());
  }

  private static String normalizeContentType(String value) {
    if (value == null) return "";
    int parametersStart = value.indexOf(';');
    String mediaType = parametersStart >= 0 ? value.substring(0, parametersStart) : value;
    return mediaType.trim().toLowerCase(Locale.ROOT);
  }

  private static String normalizeIdempotencyKey(String key) {
    if (key == null || key.isBlank()) return null;
    String normalized = key.trim();
    if (normalized.length() > 255) {
      throw new IllegalArgumentException("Idempotency-Key is too long");
    }
    return normalized;
  }
}
