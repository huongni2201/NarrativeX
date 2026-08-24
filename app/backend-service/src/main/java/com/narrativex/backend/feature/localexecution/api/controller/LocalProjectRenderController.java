package com.narrativex.backend.feature.localexecution.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.localexecution.application.port.out.LocalProjectRenderStore;
import com.narrativex.backend.feature.localexecution.application.usecase.LocalProjectRenderUseCase;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/local-devices/project-renders")
public class LocalProjectRenderController {
  private static final String DEVICE_TOKEN_HEADER = "X-NX-Device-Token";

  private final LocalProjectRenderUseCase useCase;

  @PostMapping("/claim")
  public ResponseEntity<ApiResponse<ClaimResponse>> claim(
      @RequestHeader(DEVICE_TOKEN_HEADER) String deviceToken) {
    var claimed = useCase.claim(deviceToken);
    if (claimed.isEmpty()) {
      return ResponseEntity.noContent().build();
    }
    return ResponseEntity.ok(
        ApiResponse.success("Desktop project render claimed", ClaimResponse.from(claimed.get())));
  }

  @PostMapping("/{jobId}/heartbeat")
  public ResponseEntity<ApiResponse<Void>> heartbeat(
      @RequestHeader(DEVICE_TOKEN_HEADER) String deviceToken,
      @PathVariable UUID jobId,
      @Valid @RequestBody LeaseRequest request) {
    useCase.heartbeat(deviceToken, jobId, request.leaseToken());
    return ResponseEntity.ok(ApiResponse.success("Desktop project render heartbeat accepted"));
  }

  @PostMapping("/{jobId}/progress")
  public ResponseEntity<ApiResponse<Void>> progress(
      @RequestHeader(DEVICE_TOKEN_HEADER) String deviceToken,
      @PathVariable UUID jobId,
      @Valid @RequestBody ProgressRequest request) {
    useCase.updateProgress(
        deviceToken, jobId, request.leaseToken(), request.progress(), request.currentStep());
    return ResponseEntity.ok(ApiResponse.success("Desktop project render progress updated"));
  }

  @PostMapping("/{jobId}/complete")
  public ResponseEntity<ApiResponse<Void>> complete(
      @RequestHeader(DEVICE_TOKEN_HEADER) String deviceToken,
      @PathVariable UUID jobId,
      @Valid @RequestBody CompleteRequest request) {
    useCase.complete(
        deviceToken,
        jobId,
        request.leaseToken(),
        new LocalProjectRenderStore.CompletionResult(
            request.renderFingerprint(),
            request.storageKey(),
            request.storageProvider(),
            request.externalFileId(),
            request.webViewLink(),
            request.mimeType(),
            request.sizeBytes(),
            request.checksumSha256(),
            request.durationMs(),
            request.width(),
            request.height(),
            request.fps()));
    return ResponseEntity.ok(ApiResponse.success("Desktop project render completed"));
  }

  @PostMapping("/{jobId}/fail")
  public ResponseEntity<ApiResponse<Void>> fail(
      @RequestHeader(DEVICE_TOKEN_HEADER) String deviceToken,
      @PathVariable UUID jobId,
      @Valid @RequestBody FailRequest request) {
    useCase.fail(
        deviceToken, jobId, request.leaseToken(), request.errorCode(), request.retryable());
    return ResponseEntity.ok(ApiResponse.success("Desktop project render failure recorded"));
  }

  public record LeaseRequest(@NotNull UUID leaseToken) {}

  public record ProgressRequest(
      @NotNull UUID leaseToken,
      @Min(5) @Max(99) int progress,
      @NotBlank @Size(max = 80) String currentStep) {}

  public record CompleteRequest(
      @NotNull UUID leaseToken,
      @NotBlank @Pattern(regexp = "^[0-9a-f]{64}$") String renderFingerprint,
      @NotBlank @Size(max = 1024) String storageKey,
      @NotBlank @Size(max = 32) String storageProvider,
      @Size(max = 255) String externalFileId,
      @Size(max = 4096) String webViewLink,
      @NotBlank @Pattern(regexp = "video/mp4") String mimeType,
      @Min(1) long sizeBytes,
      @NotBlank @Pattern(regexp = "^[0-9a-f]{64}$") String checksumSha256,
      @Min(1) long durationMs,
      @Min(1) int width,
      @Min(1) int height,
      @Min(1) int fps) {}

  public record FailRequest(
      @NotNull UUID leaseToken,
      @NotBlank @Size(max = 80) String errorCode,
      boolean retryable) {}

  public record ClaimResponse(
      UUID jobId,
      UUID projectId,
      UUID storyVersionId,
      String resolution,
      String format,
      String aspectRatio,
      long totalDurationMs,
      String renderProfileJson,
      UUID leaseToken,
      List<ChapterInputResponse> chapters,
      List<BeatInputResponse> beats) {
    static ClaimResponse from(LocalProjectRenderStore.ClaimedProjectRender value) {
      return new ClaimResponse(
          value.jobId(),
          value.projectId(),
          value.storyVersionId(),
          value.resolution(),
          value.format(),
          value.aspectRatio(),
          value.totalDurationMs(),
          value.renderProfileJson(),
          value.leaseToken(),
          value.chapters().stream().map(ChapterInputResponse::from).toList(),
          value.beats().stream().map(BeatInputResponse::from).toList());
    }
  }

  public record ChapterInputResponse(
      UUID chapterId,
      int orderIndex,
      long globalStartMs,
      long globalEndMs,
      String storageKey,
      long sizeBytes,
      String checksum,
      long durationMs) {
    static ChapterInputResponse from(LocalProjectRenderStore.ChapterInput value) {
      return new ChapterInputResponse(
          value.chapterId(),
          value.orderIndex(),
          value.globalStartMs(),
          value.globalEndMs(),
          value.storageKey(),
          value.sizeBytes(),
          value.checksum(),
          value.durationMs());
    }
  }

  public record BeatInputResponse(
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
      String checksum) {
    static BeatInputResponse from(LocalProjectRenderStore.BeatInput value) {
      return new BeatInputResponse(
          value.chapterId(),
          value.sceneIndex(),
          value.beatIndex(),
          value.visualBeatId(),
          value.globalStartMs(),
          value.globalEndMs(),
          value.durationMs(),
          value.cameraMovement(),
          value.storageKey(),
          value.sizeBytes(),
          value.checksum());
    }
  }
}
