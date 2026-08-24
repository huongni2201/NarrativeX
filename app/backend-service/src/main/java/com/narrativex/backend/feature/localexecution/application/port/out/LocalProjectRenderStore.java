package com.narrativex.backend.feature.localexecution.application.port.out;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LocalProjectRenderStore {
  Optional<ClaimedProjectRender> claimNext(
      UUID deviceId, String workerId, UUID leaseToken, int leaseSeconds);

  boolean heartbeat(UUID jobId, UUID deviceId, String workerId, UUID leaseToken);

  List<InputRef> listInputsForOwnedLease(
      UUID jobId, UUID deviceId, String workerId, UUID leaseToken);

  boolean updateProgress(
      UUID jobId,
      UUID deviceId,
      String workerId,
      UUID leaseToken,
      int progress,
      String currentStep);

  void complete(
      UUID jobId,
      UUID deviceId,
      String workerId,
      UUID leaseToken,
      CompletionResult result);

  boolean fail(
      UUID jobId,
      UUID deviceId,
      String workerId,
      UUID leaseToken,
      String errorCode,
      boolean retryable);

  record ClaimedProjectRender(
      UUID generationJobId,
      UUID jobId,
      UUID projectId,
      UUID storyVersionId,
      String resolution,
      String format,
      String aspectRatio,
      long totalDurationMs,
      String renderProfileJson,
      UUID leaseToken,
      List<ChapterInput> chapters,
      List<BeatInput> beats) {
    public ClaimedProjectRender {
      chapters = List.copyOf(chapters);
      beats = List.copyOf(beats);
    }
  }

  record ChapterInput(
      UUID chapterId,
      int orderIndex,
      long globalStartMs,
      long globalEndMs,
      String storageKey,
      long sizeBytes,
      String checksum,
      long durationMs) {}

  record BeatInput(
      UUID chapterId,
      int sceneIndex,
      int beatIndex,
      UUID visualBeatId,
      long globalStartMs,
      long globalEndMs,
      long durationMs,
      String cameraMovement,
      String storageKey,
      long sizeBytes,
      String checksum) {}

  record InputRef(String storageKey, long sizeBytes, String checksum, String mediaKind) {}

  record CompletionResult(
      String renderFingerprint,
      String storageKey,
      String storageProvider,
      String externalFileId,
      String webViewLink,
      String mimeType,
      long sizeBytes,
      String checksumSha256,
      long durationMs,
      int width,
      int height,
      int fps) {}
}
