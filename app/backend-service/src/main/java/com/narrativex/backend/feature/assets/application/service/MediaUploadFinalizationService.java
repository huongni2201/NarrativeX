package com.narrativex.backend.feature.assets.application.service;

import com.narrativex.backend.feature.assets.application.port.out.MediaStorageCleanupTaskRepository;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository.UploadSession;
import com.narrativex.backend.feature.assets.application.port.out.MediaValidationJobRepository;
import com.narrativex.backend.feature.assets.application.port.out.MediaValidationJobRepository.ValidationRequest;
import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort.StoredObject;
import com.narrativex.backend.feature.assets.application.port.out.VoiceReferenceAssetRepository;
import com.narrativex.backend.feature.assets.application.port.out.VoiceReferenceAssetRepository.CreateVoiceReference;
import com.narrativex.backend.feature.assets.application.port.out.VoiceReferenceAssetRepository.VoiceReferenceAsset;
import com.narrativex.backend.feature.assets.application.query.UploadFinalizeView;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owns the short authoritative transaction after an R2 voice-reference object is verified. */
@Service
public class MediaUploadFinalizationService {
  private final MediaUploadSessionRepository sessions;
  private final VoiceReferenceAssetRepository voiceReferences;
  private final MediaStorageCleanupTaskRepository cleanupTasks;
  private final MediaValidationJobRepository validationJobs;
  private final Clock clock = Clock.systemUTC();

  public MediaUploadFinalizationService(
      MediaUploadSessionRepository sessions,
      VoiceReferenceAssetRepository voiceReferences,
      MediaStorageCleanupTaskRepository cleanupTasks) {
    this(sessions, voiceReferences, cleanupTasks, null);
  }

  @org.springframework.beans.factory.annotation.Autowired
  public MediaUploadFinalizationService(
      MediaUploadSessionRepository sessions,
      VoiceReferenceAssetRepository voiceReferences,
      MediaStorageCleanupTaskRepository cleanupTasks,
      MediaValidationJobRepository validationJobs) {
    this.sessions = sessions;
    this.voiceReferences = voiceReferences;
    this.cleanupTasks = cleanupTasks;
    this.validationJobs = validationJobs;
  }

  @Transactional
  public UploadFinalizeView finalizeVerifiedObject(
      String accountId, UUID sessionId, StoredObject storedObject) {
    return finalizeLocked(accountId, sessionId, storedObject);
  }

  @Transactional
  public UploadFinalizeView finalizeMissingObject(String accountId, UUID sessionId) {
    return finalizeLocked(accountId, sessionId, null);
  }

  @Transactional
  public UploadFinalizeView returnAuthoritativeResult(String accountId, UUID sessionId) {
    return finalizeLocked(accountId, sessionId, null);
  }

  @Transactional
  public void rejectExpired(String accountId, UUID sessionId) {
    UploadSession locked = requireOwnedForUpdate(accountId, sessionId);
    if ("PENDING_UPLOAD".equals(locked.status())
        && locked.expiresAt().isBefore(Instant.now(clock))) {
      rejectAndScheduleCleanup(accountId, locked, "EXPIRED_UPLOAD");
    }
  }

  private UploadFinalizeView finalizeLocked(
      String accountId, UUID sessionId, StoredObject storedObject) {
    UploadSession locked = requireOwnedForUpdate(accountId, sessionId);
    return switch (locked.status()) {
      case "READY", "VALIDATING" -> authoritativeView(locked);
      case "REJECTED" -> rejectedView(locked);
      case "PENDING_UPLOAD" -> finalizePending(accountId, locked, storedObject);
      default ->
          throw new IllegalStateException("Unsupported upload session status: " + locked.status());
    };
  }

  private UploadFinalizeView finalizePending(
      String accountId, UploadSession locked, StoredObject storedObject) {
    if (locked.expiresAt().isBefore(Instant.now(clock))) {
      return rejectAndScheduleCleanup(accountId, locked, "EXPIRED_UPLOAD");
    }
    if (storedObject == null || !matches(locked, storedObject)) {
      return rejectAndScheduleCleanup(accountId, locked, "UPLOAD_VERIFICATION_FAILED");
    }

    String checksum = storedObject.sha256().toLowerCase(Locale.ROOT);
    VoiceReferenceAsset canonical =
        voiceReferences.createOrReuse(
            accountId,
            new CreateVoiceReference(
                UuidV7.random(),
                locked.storageKey(),
                locked.originalFilename(),
                normalizeContentType(storedObject.contentType()),
                storedObject.sizeBytes(),
                checksum));
    if (!canonical.storageKey().equals(locked.storageKey())) {
      scheduleCleanup(locked.storageKey(), "DUPLICATE_UPLOAD");
    }
    if ("READY".equals(canonical.status())) {
      if (!sessions.markReady(accountId, locked.id(), canonical.id())) {
        throw new ResourceConflictException("Upload finalization state changed unexpectedly");
      }
      return new UploadFinalizeView(locked.id(), "READY", canonical.id());
    }
    if ("REJECTED".equals(canonical.status())) {
      if (!sessions.markRejected(accountId, locked.id())) {
        throw new ResourceConflictException("Upload finalization state changed unexpectedly");
      }
      return rejectedView(locked);
    }
    markSessionValidating(accountId, locked, canonical.id());
    if (validationJobs != null) {
      validationJobs.enqueue(
          new ValidationRequest(
              canonical.id(),
              accountId,
              canonical.storageKey(),
              "AUDIO",
              canonical.contentType(),
              canonical.sizeBytes(),
              canonical.sha256()));
    }
    return new UploadFinalizeView(locked.id(), "VALIDATING", canonical.id());
  }

  private UploadFinalizeView rejectAndScheduleCleanup(
      String accountId, UploadSession locked, String reason) {
    if (!sessions.markRejected(accountId, locked.id())) {
      throw new ResourceConflictException("Upload finalization state changed unexpectedly");
    }
    scheduleCleanup(locked.storageKey(), reason);
    return rejectedView(locked);
  }

  private void markSessionValidating(String accountId, UploadSession locked, UUID assetId) {
    if (!sessions.markValidating(accountId, locked.id(), assetId)) {
      throw new ResourceConflictException("Upload finalization state changed unexpectedly");
    }
  }

  private void scheduleCleanup(String storageKey, String reason) {
    cleanupTasks.enqueue(storageKey, reason, Instant.now(clock));
  }

  private UploadSession requireOwnedForUpdate(String accountId, UUID sessionId) {
    return sessions
        .findOwnedForUpdate(accountId, sessionId)
        .orElseThrow(() -> new ResourceNotFoundException("Upload session not found"));
  }

  private static UploadFinalizeView authoritativeView(UploadSession session) {
    if (session.mediaAssetId() == null) {
      throw new IllegalStateException("Finalized upload session has no voice reference asset");
    }
    return new UploadFinalizeView(session.id(), session.status(), session.mediaAssetId());
  }

  private static UploadFinalizeView rejectedView(UploadSession session) {
    return new UploadFinalizeView(session.id(), "REJECTED", null);
  }

  private static boolean matches(UploadSession session, StoredObject object) {
    return session.storageKey().equals(object.storageKey())
        && session.expectedSize() == object.sizeBytes()
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
}
