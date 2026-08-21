package com.narrativex.backend.feature.assets.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.assets.application.command.CreateUploadIntentCommand;
import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository.CreateUploadSession;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository.UploadSession;
import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort;
import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort.PresignedUpload;
import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort.StoredObject;
import com.narrativex.backend.feature.assets.application.query.UploadFinalizeView;
import com.narrativex.backend.feature.assets.application.query.UploadIntentView;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
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
  @Mock private MediaAssetRepository assets;
  @Mock private ObjectStoragePort objectStorage;

  private MediaUploadUseCase useCase;

  @BeforeEach
  void setUp() {
    when(currentUserId.get()).thenReturn(ACCOUNT);
    useCase = new MediaUploadUseCase(currentUserId, sessions, assets, objectStorage);
  }

  @Test
  void createIntentGeneratesStorageKeyAndPersistsSessionBeforeReturningUrl() {
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

    assertThat(response.storageKey()).startsWith("media/uploads/");
    assertThat(response.storageKey()).doesNotContain(request.expectedSha256());
    assertThat(response.uploadUrl()).isEqualTo("https://upload.example.test/signed");
    verify(sessions).create(any());
    verify(objectStorage).createUpload(any());
  }

  @Test
  void sameIdempotencyKeyReturnsExistingIntentWithoutCreatingAnotherSession() {
    UploadSession existing = session(UUID.randomUUID(), "PENDING_UPLOAD", null);
    when(sessions.findByIdempotencyKey(ACCOUNT, "retry-1")).thenReturn(Optional.of(existing));
    when(objectStorage.createUpload(any()))
        .thenReturn(new PresignedUpload(existing.storageKey(), URI.create("https://signed"), EXPIRES_AT));

    UploadIntentView response = useCase.createIntent(request(), "retry-1");

    assertThat(response.id()).isEqualTo(existing.id());
    verify(sessions, never()).create(any());
  }

  @Test
  void finalizeCreatesReadyAssetOnlyAfterStorageMetadataMatches() {
    UUID sessionId = UUID.randomUUID();
    UploadSession session = session(sessionId, "PENDING_UPLOAD", null);
    when(sessions.findOwned(ACCOUNT, sessionId)).thenReturn(Optional.of(session));
    when(objectStorage.head(session.storageKey()))
        .thenReturn(new StoredObject(session.storageKey(), session.expectedSize(), session.contentType(), SHA));
    UUID assetId = UUID.randomUUID();
    when(assets.create(any(), any()))
        .thenReturn(
            new com.narrativex.backend.feature.assets.application.query.MediaAssetView(
                assetId,
                session.assetType(),
                "USER_UPLOAD",
                session.storageKey(),
                session.originalFilename(),
                session.contentType(),
                session.expectedSize(),
                SHA,
                null,
                "PENDING_UPLOAD",
                Instant.now()));
    when(sessions.markReady(ACCOUNT, sessionId, assetId)).thenReturn(true);

    UploadFinalizeView response = useCase.finalizeUpload(sessionId);

    assertThat(response.status()).isEqualTo("READY");
    assertThat(response.mediaAssetId()).isEqualTo(assetId);
    verify(assets).markReady(ACCOUNT, assetId);
    verify(sessions).markReady(ACCOUNT, sessionId, assetId);
  }

  @Test
  void finalizeRejectsChecksumMismatchWithoutPersistingAsset() {
    UUID sessionId = UUID.randomUUID();
    UploadSession session = session(sessionId, "PENDING_UPLOAD", null);
    when(sessions.findOwned(ACCOUNT, sessionId)).thenReturn(Optional.of(session));
    when(objectStorage.head(session.storageKey()))
        .thenReturn(new StoredObject(session.storageKey(), session.expectedSize(), session.contentType(), "b".repeat(64)));

    UploadFinalizeView response = useCase.finalizeUpload(sessionId);

    assertThat(response.status()).isEqualTo("REJECTED");
    verify(sessions).markRejected(ACCOUNT, sessionId);
    verify(assets, never()).create(any(), any());
  }

  @Test
  void finalizeDoesNotAllowAnotherAccountToSeeTheSession() {
    UUID sessionId = UUID.randomUUID();
    when(sessions.findOwned(ACCOUNT, sessionId)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> useCase.finalizeUpload(sessionId))
        .isInstanceOf(ResourceNotFoundException.class);
    verify(objectStorage, never()).head(any());
  }

  private static CreateUploadIntentCommand request() {
    return new CreateUploadIntentCommand("AUDIO", "voice.wav", "audio/wav", 128, SHA);
  }

  private static UploadSession session(UUID id, String status, UUID mediaAssetId) {
    return new UploadSession(
        id,
        "AUDIO",
        "voice.wav",
        "audio/wav",
        128,
        SHA,
        "media/uploads/" + id,
        "retry-1",
        status,
        EXPIRES_AT,
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
