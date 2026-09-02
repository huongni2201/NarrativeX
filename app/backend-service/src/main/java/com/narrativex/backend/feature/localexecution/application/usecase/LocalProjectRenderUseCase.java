package com.narrativex.backend.feature.localexecution.application.usecase;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.localexecution.application.port.in.LocalDeviceAccess;
import com.narrativex.backend.feature.localexecution.application.port.out.LocalProjectRenderStore;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class LocalProjectRenderUseCase {
  public static final String CAPABILITY = "PROJECT_RENDER";
  private static final int LEASE_SECONDS = 90;

  private final LocalDeviceAccess localDeviceAccess;
  private final LocalProjectRenderStore store;

  public Optional<ClaimedProjectRender> claim(String deviceToken) {
    var device = localDeviceAccess.authenticate(deviceToken, CAPABILITY);
    UUID leaseToken = UuidV7.random();
    return store
        .claimNext(device.id(), workerId(device.id()), leaseToken, LEASE_SECONDS)
        .map(ClaimedProjectRender::from);
  }

  public void heartbeat(String deviceToken, UUID jobId, UUID leaseToken) {
    var device = localDeviceAccess.authenticate(deviceToken, CAPABILITY);
    if (!store.heartbeat(jobId, device.id(), workerId(device.id()), leaseToken)) throw leaseLost();
  }

  public void updateProgress(
      String deviceToken, UUID jobId, UUID leaseToken, int progress, String currentStep) {
    if (progress < 5 || progress >= 100) {
      throw new IllegalArgumentException("Project render progress must be between 5 and 99");
    }
    String step = currentStep == null ? "" : currentStep.trim();
    if (step.isEmpty() || step.length() > 80) {
      throw new IllegalArgumentException("currentStep must contain 1 to 80 characters");
    }
    var device = localDeviceAccess.authenticate(deviceToken, CAPABILITY);
    if (!store.updateProgress(
        jobId, device.id(), workerId(device.id()), leaseToken, progress, step)) {
      throw leaseLost();
    }
  }

  public void complete(String deviceToken, UUID jobId, UUID leaseToken, CompletionResult result) {
    var device = localDeviceAccess.authenticate(deviceToken, CAPABILITY);
    store.complete(jobId, device.id(), workerId(device.id()), leaseToken, result.toStoreResult());
  }

  public void cancel(String deviceToken, UUID jobId, UUID leaseToken) {
    var device = localDeviceAccess.authenticate(deviceToken, CAPABILITY);
    if (!store.cancel(jobId, device.id(), workerId(device.id()), leaseToken)) {
      throw leaseLost();
    }
  }

  public void fail(
      String deviceToken, UUID jobId, UUID leaseToken, String errorCode, boolean retryable) {
    String normalizedErrorCode =
        errorCode == null || errorCode.isBlank() ? "DESKTOP_RENDER_FAILED" : errorCode.trim();
    if (normalizedErrorCode.length() > 80) {
      normalizedErrorCode = normalizedErrorCode.substring(0, 80);
    }
    var device = localDeviceAccess.authenticate(deviceToken, CAPABILITY);
    if (!store.fail(
        jobId, device.id(), workerId(device.id()), leaseToken, normalizedErrorCode, retryable)) {
      throw leaseLost();
    }
  }

  private static IllegalStateException leaseLost() {
    return new IllegalStateException(
        "Desktop project render lease is no longer owned by this device");
  }

  private static String workerId(UUID deviceId) {
    return "desktop:" + deviceId;
  }

  public record ClaimedProjectRender(
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
    static ClaimedProjectRender from(LocalProjectRenderStore.ClaimedProjectRender value) {
      return new ClaimedProjectRender(
          value.generationJobId(),
          value.jobId(),
          value.projectId(),
          value.storyVersionId(),
          value.resolution(),
          value.format(),
          value.aspectRatio(),
          value.totalDurationMs(),
          value.renderProfileJson(),
          value.leaseToken(),
          value.chapters().stream().map(ChapterInput::from).toList(),
          value.beats().stream().map(BeatInput::from).toList());
    }
  }

  public record ChapterInput(
      UUID chapterId,
      int orderIndex,
      long globalStartMs,
      long globalEndMs,
      UUID narrationAssetId,
      String storageKey,
      long sizeBytes,
      String checksum,
      long durationMs,
      String subtitleText,
      String subtitleSpansJson) {
    static ChapterInput from(LocalProjectRenderStore.ChapterInput value) {
      return new ChapterInput(
          value.chapterId(),
          value.orderIndex(),
          value.globalStartMs(),
          value.globalEndMs(),
          value.narrationAssetId(),
          value.storageKey(),
          value.sizeBytes(),
          value.checksum(),
          value.durationMs(),
          value.subtitleText(),
          value.subtitleSpansJson());
    }

    public ChapterInput(
        UUID chapterId,
        int orderIndex,
        long globalStartMs,
        long globalEndMs,
        UUID narrationAssetId,
        String storageKey,
        long sizeBytes,
        String checksum,
        long durationMs) {
      this(
          chapterId,
          orderIndex,
          globalStartMs,
          globalEndMs,
          narrationAssetId,
          storageKey,
          sizeBytes,
          checksum,
          durationMs,
          "",
          null);
    }
  }

  public record BeatInput(
      UUID chapterId,
      int sceneIndex,
      int beatIndex,
      UUID visualBeatId,
      UUID mediaAssetId,
      long globalStartMs,
      long globalEndMs,
      long durationMs,
      String cameraMovement,
      String mediaType,
      Long sourceDurationMs,
      String fitMode,
      long trimStartMs,
      String storageKey,
      long sizeBytes,
      String checksum) {
    static BeatInput from(LocalProjectRenderStore.BeatInput value) {
      return new BeatInput(
          value.chapterId(),
          value.sceneIndex(),
          value.beatIndex(),
          value.visualBeatId(),
          value.mediaAssetId(),
          value.globalStartMs(),
          value.globalEndMs(),
          value.durationMs(),
          value.cameraMovement(),
          value.mediaType(),
          value.sourceDurationMs(),
          value.fitMode(),
          value.trimStartMs(),
          value.storageKey(),
          value.sizeBytes(),
          value.checksum());
    }

    public BeatInput(
        UUID chapterId,
        int sceneIndex,
        int beatIndex,
        UUID visualBeatId,
        UUID mediaAssetId,
        long globalStartMs,
        long globalEndMs,
        long durationMs,
        String cameraMovement,
        String storageKey,
        long sizeBytes,
        String checksum) {
      this(
          chapterId,
          sceneIndex,
          beatIndex,
          visualBeatId,
          mediaAssetId,
          globalStartMs,
          globalEndMs,
          durationMs,
          cameraMovement,
          "IMAGE",
          null,
          "TRIM",
          0L,
          storageKey,
          sizeBytes,
          checksum);
    }
  }

  public record CompletionResult(
      String renderFingerprint,
      String localArtifactKey,
      String mimeType,
      long sizeBytes,
      String checksumSha256,
      long durationMs,
      int width,
      int height,
      int fps) {
    LocalProjectRenderStore.CompletionResult toStoreResult() {
      return new LocalProjectRenderStore.CompletionResult(
          renderFingerprint,
          localArtifactKey,
          mimeType,
          sizeBytes,
          checksumSha256,
          durationMs,
          width,
          height,
          fps);
    }
  }
}
