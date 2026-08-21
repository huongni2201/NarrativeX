package com.narrativex.backend.feature.assets.application.usecase;

import com.narrativex.backend.feature.assets.application.command.CreateUploadIntentCommand;
import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository.CreateUploadSession;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository.UploadSession;
import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort;
import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort.CreateUpload;
import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort.PresignedUpload;
import com.narrativex.backend.feature.assets.application.query.UploadFinalizeView;
import com.narrativex.backend.feature.assets.application.query.UploadIntentView;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MediaUploadUseCase {
  private static final Duration INTENT_TTL = Duration.ofMinutes(15);

  private final CurrentUserId currentUserId;
  private final MediaUploadSessionRepository sessions;
  private final MediaAssetRepository assets;
  private final ObjectStoragePort objectStorage;
  private final Clock clock = Clock.systemUTC();

  @Transactional
  public UploadIntentView createIntent(
      CreateUploadIntentCommand request, String requestedIdempotencyKey) {
    String accountId = currentUserId.get();
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

  @Transactional
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
      sessions.markRejected(accountId, id);
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
      sessions.markRejected(accountId, id);
      return new UploadFinalizeView(session.id(), "REJECTED", null);
    }

    MediaAssetRepository.CreateMediaAsset command =
        new MediaAssetRepository.CreateMediaAsset(
            UUID.randomUUID(),
            session.assetType(),
            "USER_UPLOAD",
            session.storageKey(),
            session.originalFilename(),
            object.contentType(),
            object.sizeBytes(),
            object.sha256(),
            null);
    var asset = assets.create(accountId, command);
    assets.markReady(accountId, asset.id());
    if (!sessions.markReady(accountId, id, asset.id())) {
      throw new ResourceConflictException("Upload finalization raced with another request");
    }
    return new UploadFinalizeView(session.id(), "READY", asset.id());
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
        && session.contentType().equalsIgnoreCase(object.contentType())
        && session.expectedSha256().equalsIgnoreCase(object.sha256());
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
