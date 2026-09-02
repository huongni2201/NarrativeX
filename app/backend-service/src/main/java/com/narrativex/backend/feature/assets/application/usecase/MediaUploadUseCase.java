package com.narrativex.backend.feature.assets.application.usecase;

import com.narrativex.backend.feature.assets.application.command.CreateUploadIntentCommand;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository.CreateUploadSession;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository.UploadSession;
import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort;
import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort.CreateUpload;
import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort.PresignedUpload;
import com.narrativex.backend.feature.assets.application.query.UploadFinalizeView;
import com.narrativex.backend.feature.assets.application.query.UploadIntentView;
import com.narrativex.backend.feature.assets.application.service.MediaUploadFinalizationService;
import com.narrativex.backend.feature.assets.configuration.StorageUploadProperties;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** R2 upload workflow reserved for reusable account-owned voice references. */
@Service
public class MediaUploadUseCase {
  private static final long MAX_VOICE_REFERENCE_BYTES = 50L * 1024 * 1024;
  private static final Map<String, String> ALLOWED_VOICE_CONTENT_TYPES =
      Map.of("audio/mpeg", "mp3", "audio/wav", "wav", "audio/x-wav", "wav");

  private final CurrentUserId currentUserId;
  private final MediaUploadSessionRepository sessions;
  private final ObjectStoragePort objectStorage;
  private final MediaUploadFinalizationService finalization;
  private final StorageUploadProperties storageProperties;
  private final Clock clock;

  @Autowired
  public MediaUploadUseCase(
      CurrentUserId currentUserId,
      MediaUploadSessionRepository sessions,
      ObjectStoragePort objectStorage,
      MediaUploadFinalizationService finalization,
      StorageUploadProperties storageProperties) {
    this(
        currentUserId, sessions, objectStorage, finalization, storageProperties, Clock.systemUTC());
  }

  public MediaUploadUseCase(
      CurrentUserId currentUserId,
      MediaUploadSessionRepository sessions,
      ObjectStoragePort objectStorage,
      MediaUploadFinalizationService finalization) {
    this(
        currentUserId,
        sessions,
        objectStorage,
        finalization,
        new StorageUploadProperties(Duration.ofMinutes(15)),
        Clock.systemUTC());
  }

  MediaUploadUseCase(
      CurrentUserId currentUserId,
      MediaUploadSessionRepository sessions,
      ObjectStoragePort objectStorage,
      MediaUploadFinalizationService finalization,
      StorageUploadProperties storageProperties,
      Clock clock) {
    this.currentUserId = currentUserId;
    this.sessions = sessions;
    this.objectStorage = objectStorage;
    this.finalization = finalization;
    this.storageProperties = storageProperties;
    this.clock = clock;
  }

  @Transactional
  public UploadIntentView createIntent(
      CreateUploadIntentCommand request, String requestedIdempotencyKey) {
    String accountId = currentUserId.get();
    validateVoiceReferenceRequest(request);
    String idempotencyKey = normalizeIdempotencyKey(requestedIdempotencyKey);
    if (idempotencyKey != null) {
      UploadSession existing =
          sessions.findByIdempotencyKey(accountId, idempotencyKey).orElse(null);
      if (existing != null) {
        if (!sameRequest(existing, request)) {
          throw new ResourceConflictException(
              "Idempotency key was already used for another upload");
        }
        Instant now = clock.instant();
        if ("READY".equals(existing.status())) {
          return intentResponseWithoutUpload(existing);
        }
        if ("REJECTED".equals(existing.status()) || !existing.expiresAt().isAfter(now)) {
          throw new ResourceConflictException(
              "The existing upload intent is no longer reusable; create a new idempotency key");
        }
        return intentResponse(existing);
      }
    }

    Instant expiresAt = clock.instant().plus(storageProperties.uploadIntentTtl());
    UUID id = UuidV7.random();
    String storageKey = voiceStorageKey(accountId, id);
    UploadSession session =
        sessions.create(
            new CreateUploadSession(
                id,
                accountId,
                "AUDIO",
                request.originalFilename().trim(),
                normalize(request.contentType()),
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
            .findOwnedSnapshot(accountId, id)
            .orElseThrow(() -> new ResourceNotFoundException("Upload session not found"));

    if ("READY".equals(session.status()) || "VALIDATING".equals(session.status())) {
      return finalization.returnAuthoritativeResult(accountId, id);
    }
    if ("REJECTED".equals(session.status())) {
      return finalization.returnAuthoritativeResult(accountId, id);
    }

    ObjectStoragePort.StoredObject object;
    try {
      object = objectStorage.head(session.storageKey());
    } catch (ObjectStoragePort.ObjectNotFoundException exception) {
      return finalization.finalizeMissingObject(accountId, id);
    }
    return finalization.finalizeVerifiedObject(accountId, id, object);
  }

  private static void validateVoiceReferenceRequest(CreateUploadIntentCommand request) {
    String type = normalize(request.assetType()).toUpperCase(Locale.ROOT);
    String contentType = normalize(request.contentType());
    if (!"AUDIO".equals(type)) {
      throw new IllegalArgumentException("R2 upload accepts voice reference audio only");
    }
    if (!ALLOWED_VOICE_CONTENT_TYPES.containsKey(contentType)) {
      throw new IllegalArgumentException("Content type is not allowed for a voice reference");
    }
    if (request.expectedSizeBytes() <= 0
        || request.expectedSizeBytes() > MAX_VOICE_REFERENCE_BYTES) {
      throw new IllegalArgumentException(
          "Voice reference exceeds the server-authorized size limit");
    }
    String filename = request.originalFilename() == null ? "" : request.originalFilename().trim();
    if (filename.isBlank()
        || filename.contains("/")
        || filename.contains("\\")
        || filename.indexOf('\0') >= 0) {
      throw new IllegalArgumentException("Voice reference filename is invalid");
    }
    String extension = ALLOWED_VOICE_CONTENT_TYPES.get(contentType);
    if (!filename.toLowerCase(Locale.ROOT).endsWith("." + extension)) {
      throw new IllegalArgumentException("Voice reference filename does not match content type");
    }
  }

  private static String voiceStorageKey(String accountId, UUID uploadId) {
    String safeAccount =
        accountId == null ? "unknown" : accountId.trim().replaceAll("[^A-Za-z0-9._-]", "_");
    if (safeAccount.isBlank()) {
      throw new IllegalArgumentException("Authenticated account id is required for voice upload");
    }
    return "voices/" + safeAccount + "/uploads/" + uploadId;
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

  private static UploadIntentView intentResponseWithoutUpload(UploadSession session) {
    return new UploadIntentView(
        session.id(),
        session.assetType(),
        session.originalFilename(),
        session.contentType(),
        session.expectedSize(),
        session.expectedSha256(),
        session.storageKey(),
        null,
        Map.of(),
        session.status(),
        session.expiresAt());
  }

  private static boolean sameRequest(UploadSession session, CreateUploadIntentCommand request) {
    return session.assetType().equals("AUDIO")
        && session.originalFilename().equals(request.originalFilename().trim())
        && session.contentType().equals(normalize(request.contentType()))
        && session.expectedSize() == request.expectedSizeBytes()
        && session.expectedSha256().equals(request.expectedSha256());
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
