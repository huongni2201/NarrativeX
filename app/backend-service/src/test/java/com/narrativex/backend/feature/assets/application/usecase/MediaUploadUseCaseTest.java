package com.narrativex.backend.feature.assets.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.assets.application.command.CreateUploadIntentCommand;
import com.narrativex.backend.feature.assets.application.port.out.MediaStorageCleanupTaskRepository;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository.CreateUploadSession;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository.UploadSession;
import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort;
import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort.PresignedUpload;
import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort.StoredObject;
import com.narrativex.backend.feature.assets.application.port.out.VoiceReferenceAssetRepository;
import com.narrativex.backend.feature.assets.application.port.out.VoiceReferenceAssetRepository.VoiceReferenceAsset;
import com.narrativex.backend.feature.assets.application.query.UploadFinalizeView;
import com.narrativex.backend.feature.assets.application.query.UploadIntentView;
import com.narrativex.backend.feature.assets.application.service.MediaUploadFinalizationService;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import java.net.URI;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class MediaUploadUseCaseTest {
  private static final String ACCOUNT = "account-a";
  private static final String SHA = "a".repeat(64);
  private static final Instant EXPIRES_AT = Instant.now().plusSeconds(900);

  @Mock private CurrentUserId currentUserId;
  @Mock private MediaUploadSessionRepository sessions;
  @Mock private VoiceReferenceAssetRepository voiceReferences;
  @Mock private MediaStorageCleanupTaskRepository cleanupTasks;
  @Mock private ObjectStoragePort objectStorage;

  private MediaUploadUseCase useCase;

  @BeforeEach
  void setUp() {
    when(currentUserId.get()).thenReturn(ACCOUNT);
    useCase =
        new MediaUploadUseCase(
            currentUserId,
            sessions,
            objectStorage,
            new MediaUploadFinalizationService(sessions, voiceReferences, cleanupTasks));
    lenient()
        .when(voiceReferences.createOrReuse(any(), any()))
        .thenAnswer(
            invocation ->
                new VoiceReferenceAsset(
                    invocation.<VoiceReferenceAssetRepository.CreateVoiceReference>getArgument(1)
                        .proposedId(),
                    invocation.<VoiceReferenceAssetRepository.CreateVoiceReference>getArgument(1)
                        .storageKey(),
                    "voice.wav",
                    "audio/wav",
                    128,
                    SHA,
                    "VALIDATING"));
  }

  @Test
  void createIntentGeneratesAccountScopedVoiceStorageKeyAndPersistsSessionBeforeReturningUrl() {
    CreateUploadIntentCommand request = request();
    when(sessions.create(any()))
        .thenAnswer(invocation -> session(invocation.getArgument(0, CreateUploadSession.class)));
    when(objectStorage.createUpload(any()))
        .thenAnswer(
            invocation ->
                new PresignedUpload(
                    invocation.getArgument(0, ObjectStoragePort.CreateUpload.class).storageKey(),
                    URI.create("https://upload.example.test/signed"),
                    EXPIRES_AT));

    UploadIntentView response = useCase.createIntent(request, "retry-1");

    assertThat(response.storageKey()).startsWith("voices/account-a/");
    assertThat(response.storageKey()).doesNotContain(request.expectedSha256());
    assertThat(response.uploadUrl()).isEqualTo("https://upload.example.test/signed");
    verify(sessions).create(any());
    verify(objectStorage).createUpload(any());
  }

  @Test
  void createIntentRejectsNonVoiceProjectMedia() {
    CreateUploadIntentCommand image =
        new CreateUploadIntentCommand("IMAGE", "shot.png", "image/png", 128, SHA);

    assertThatThrownBy(() -> useCase.createIntent(image, null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("voice reference");
    verify(sessions, never()).create(any());
    verify(objectStorage, never()).createUpload(any());
  }

  @Test
  void createIntentRejectsUnsupportedVoiceContainer() {
    CreateUploadIntentCommand ogg =
        new CreateUploadIntentCommand("AUDIO", "voice.ogg", "audio/ogg", 128, SHA);

    assertThatThrownBy(() -> useCase.createIntent(ogg, null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("voice reference");
    verify(sessions, never()).create(any());
  }

  @Test
  void sameIdempotencyKeyReturnsExistingIntentWithoutCreatingAnotherSession() {
    UploadSession existing = session(UUID.randomUUID(), "PENDING_UPLOAD", null);
    when(sessions.findByIdempotencyKey(ACCOUNT, "retry-1")).thenReturn(Optional.of(existing));
    when(objectStorage.createUpload(any()))
        .thenReturn(
            new PresignedUpload(existing.storageKey(), URI.create("https://signed"), EXPIRES_AT));

    UploadIntentView response = useCase.createIntent(request(), "retry-1");

    assertThat(response.id()).isEqualTo(existing.id());
    verify(sessions, never()).create(any());
  }

  @Test
  void readyIdempotentSessionReturnsStatusWithoutSigningAnotherUploadUrl() {
    UploadSession existing = session(UUID.randomUUID(), "READY", UUID.randomUUID());
    when(sessions.findByIdempotencyKey(ACCOUNT, "retry-1")).thenReturn(Optional.of(existing));

    UploadIntentView response = useCase.createIntent(request(), "retry-1");

    assertThat(response.status()).isEqualTo("READY");
    assertThat(response.uploadUrl()).isNull();
    assertThat(response.uploadHeaders()).isEmpty();
    verify(objectStorage, never()).createUpload(any());
  }

  @Test
  void rejectedIdempotentSessionCannotBeSignedAgain() {
    UploadSession existing = session(UUID.randomUUID(), "REJECTED", null);
    when(sessions.findByIdempotencyKey(ACCOUNT, "retry-1")).thenReturn(Optional.of(existing));

    assertThatThrownBy(() -> useCase.createIntent(request(), "retry-1"))
        .isInstanceOf(ResourceConflictException.class);
    verify(objectStorage, never()).createUpload(any());
  }

  @Test
  void expiredIdempotentSessionCannotBeSignedAgain() {
    UploadSession existing =
        session(UUID.randomUUID(), "PENDING_UPLOAD", null, Instant.now().minusSeconds(1));
    when(sessions.findByIdempotencyKey(ACCOUNT, "retry-1")).thenReturn(Optional.of(existing));

    assertThatThrownBy(() -> useCase.createIntent(request(), "retry-1"))
        .isInstanceOf(ResourceConflictException.class);
    verify(objectStorage, never()).createUpload(any());
  }

  @Test
  void finalizeCreatesValidatingVoiceReferenceOnlyAfterStorageMetadataMatches() {
    UUID sessionId = UUID.randomUUID();
    UploadSession session = session(sessionId, "PENDING_UPLOAD", null);
    when(sessions.findOwnedSnapshot(ACCOUNT, sessionId)).thenReturn(Optional.of(session));
    when(sessions.findOwnedForUpdate(ACCOUNT, sessionId)).thenReturn(Optional.of(session));
    when(objectStorage.head(session.storageKey()))
        .thenReturn(
            new StoredObject(
                session.storageKey(), session.expectedSize(), session.contentType(), SHA));
    UUID assetId = UUID.randomUUID();
    when(voiceReferences.createOrReuse(any(), any()))
        .thenReturn(
            new VoiceReferenceAsset(
                assetId,
                session.storageKey(),
                session.originalFilename(),
                session.contentType(),
                session.expectedSize(),
                SHA,
                "VALIDATING"));
    when(sessions.markValidating(ACCOUNT, sessionId, assetId)).thenReturn(true);

    UploadFinalizeView response = useCase.finalizeUpload(sessionId);

    assertThat(response.status()).isEqualTo("VALIDATING");
    assertThat(response.mediaAssetId()).isEqualTo(assetId);
    verify(voiceReferences).createOrReuse(any(), any());
    verify(sessions).markValidating(ACCOUNT, sessionId, assetId);
  }

  @Test
  void finalizeReusesExistingVerifiedVoiceReferenceForDuplicateChecksum() {
    UUID sessionId = UUID.randomUUID();
    UploadSession session = session(sessionId, "PENDING_UPLOAD", null);
    UUID existingAssetId = UUID.randomUUID();
    when(sessions.findOwnedSnapshot(ACCOUNT, sessionId)).thenReturn(Optional.of(session));
    when(sessions.findOwnedForUpdate(ACCOUNT, sessionId)).thenReturn(Optional.of(session));
    when(objectStorage.head(session.storageKey()))
        .thenReturn(
            new StoredObject(
                session.storageKey(), session.expectedSize(), session.contentType(), SHA));
    when(voiceReferences.createOrReuse(any(), any()))
        .thenReturn(
            new VoiceReferenceAsset(
                existingAssetId,
                "voices/account-a/existing",
                session.originalFilename(),
                session.contentType(),
                session.expectedSize(),
                SHA,
                "READY"));
    when(sessions.markReady(ACCOUNT, sessionId, existingAssetId)).thenReturn(true);

    UploadFinalizeView response = useCase.finalizeUpload(sessionId);

    assertThat(response.status()).isEqualTo("READY");
    assertThat(response.mediaAssetId()).isEqualTo(existingAssetId);
    verify(voiceReferences).createOrReuse(any(), any());
    verify(cleanupTasks).enqueue(any(), org.mockito.ArgumentMatchers.eq("DUPLICATE_UPLOAD"), any());
  }

  @Test
  void finalizeAcceptsStorageContentTypeWithParameters() {
    UUID sessionId = UUID.randomUUID();
    UploadSession session = session(sessionId, "PENDING_UPLOAD", null);
    when(sessions.findOwnedSnapshot(ACCOUNT, sessionId)).thenReturn(Optional.of(session));
    when(sessions.findOwnedForUpdate(ACCOUNT, sessionId)).thenReturn(Optional.of(session));
    when(objectStorage.head(session.storageKey()))
        .thenReturn(
            new StoredObject(
                session.storageKey(), session.expectedSize(), "audio/wav; charset=binary", SHA));
    UUID assetId = UUID.randomUUID();
    when(voiceReferences.createOrReuse(any(), any()))
        .thenReturn(
            new VoiceReferenceAsset(
                assetId,
                session.storageKey(),
                session.originalFilename(),
                session.contentType(),
                session.expectedSize(),
                SHA,
                "VALIDATING"));
    when(sessions.markValidating(ACCOUNT, sessionId, assetId)).thenReturn(true);
    UploadFinalizeView response = useCase.finalizeUpload(sessionId);

    assertThat(response.status()).isEqualTo("VALIDATING");
  }

  @Test
  void finalizeRejectsChecksumMismatchWithoutPersistingVoiceReference() {
    UUID sessionId = UUID.randomUUID();
    UploadSession session = session(sessionId, "PENDING_UPLOAD", null);
    when(sessions.findOwnedSnapshot(ACCOUNT, sessionId)).thenReturn(Optional.of(session));
    when(sessions.findOwnedForUpdate(ACCOUNT, sessionId)).thenReturn(Optional.of(session));
    when(objectStorage.head(session.storageKey()))
        .thenReturn(
            new StoredObject(
                session.storageKey(),
                session.expectedSize(),
                session.contentType(),
                "b".repeat(64)));
    when(sessions.markRejected(ACCOUNT, sessionId)).thenReturn(true);

    UploadFinalizeView response = useCase.finalizeUpload(sessionId);

    assertThat(response.status()).isEqualTo("REJECTED");
    verify(sessions).markRejected(ACCOUNT, sessionId);
    verify(cleanupTasks)
        .enqueue(any(), org.mockito.ArgumentMatchers.eq("UPLOAD_VERIFICATION_FAILED"), any());
    verify(voiceReferences, never()).createOrReuse(any(), any());
  }

  @Test
  void finalizeDoesNotAllowAnotherAccountToSeeTheSession() {
    UUID sessionId = UUID.randomUUID();
    when(sessions.findOwnedSnapshot(ACCOUNT, sessionId)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> useCase.finalizeUpload(sessionId))
        .isInstanceOf(ResourceNotFoundException.class);
    verify(objectStorage, never()).head(any());
  }

  private static CreateUploadIntentCommand request() {
    return new CreateUploadIntentCommand("AUDIO", "voice.wav", "audio/wav", 128, SHA);
  }

  private static UploadSession session(UUID id, String status, UUID mediaAssetId) {
    return session(id, status, mediaAssetId, EXPIRES_AT);
  }

  private static UploadSession session(
      UUID id, String status, UUID mediaAssetId, Instant expiresAt) {
    return new UploadSession(
        id,
        "AUDIO",
        "voice.wav",
        "audio/wav",
        128,
        SHA,
        "voices/account-a/" + id,
        "retry-1",
        status,
        expiresAt,
        Instant.now(),
        mediaAssetId);
  }

  private static UploadSession session(MediaUploadSessionRepository.CreateUploadSession command) {
    return new UploadSession(
        command.id(),
        command.assetType(),
        command.originalFilename(),
        command.contentType(),
        command.expectedSize(),
        command.expectedSha256(),
        command.storageKey(),
        command.idempotencyKey(),
        "PENDING_UPLOAD",
        command.expiresAt(),
        Instant.now(),
        null);
  }
}
