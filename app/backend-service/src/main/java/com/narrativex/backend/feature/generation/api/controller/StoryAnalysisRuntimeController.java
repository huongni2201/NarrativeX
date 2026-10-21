package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.application.model.analysis.AnalysisRuntimeConfiguration;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisStage;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisUsage;
import com.narrativex.backend.feature.generation.application.port.in.LocalChapterAnalysis;
import com.narrativex.backend.feature.generation.domain.enums.ChapterAnalysisExecutionMode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

@RestController
@RequiredArgsConstructor
public class StoryAnalysisRuntimeController {
  private final LocalChapterAnalysis service;
  private static final String ROOT = "/api/v1/local-devices/chapter-analyses";
  private static final String CREDENTIALS = "/api/v1/local-devices/analysis-credentials";

  @GetMapping("/api/v1/story-analysis/configuration")
  public ApiResponse<AnalysisRuntimeConfiguration> configuration() {
    return ApiResponse.success("Analysis configuration", service.configuration());
  }

  @PutMapping("/api/v1/story-analysis/configuration")
  public ApiResponse<AnalysisRuntimeConfiguration> configure(@Valid @RequestBody Settings s) {
    return ApiResponse.success(
        "Analysis configuration saved",
        service.configure(
            s.executionMode(), s.model(), s.effort(), s.maxConcurrentAnalyses(), s.rowVersion()));
  }

  @PostMapping(CREDENTIALS)
  public ApiResponse<CredentialRegistration> register(
      @RequestHeader("X-NX-Device-Token") String device, @Valid @RequestBody Registration r) {
    var credential =
        service.registerCredential(
            device,
            r.fingerprint(),
            r.label(),
            r.adapterVersion(),
            r.models() == null ? List.of() : r.models());
    return ApiResponse.success(
        "Analysis credential registered",
        new CredentialRegistration(credential.credentialRef(), credential.credentialGeneration()));
  }

  @PostMapping(CREDENTIALS + "/{credentialRef}/observation")
  public ApiResponse<Void> observeCredential(
      @RequestHeader("X-NX-Device-Token") String device,
      @PathVariable UUID credentialRef,
      @Valid @RequestBody CredentialObservation r) {
    service.observeCredential(
        device, credentialRef, r.connectionState(), r.quotaState(), r.nextEligibleAt());
    return ApiResponse.success("Credential observation accepted");
  }

  @PostMapping(ROOT + "/claim")
  public ResponseEntity<ApiResponse<LocalChapterAnalysis.Claim>> claim(
      @RequestHeader("X-NX-Device-Token") String device, @Valid @RequestBody ClaimRequest request) {
    var claim =
        service.claim(
            device, request.claimRequestId(), request.credentialRef(), request.adapterVersion());
    return claim == null
        ? ResponseEntity.noContent().build()
        : ResponseEntity.ok(ApiResponse.success("Analysis claimed", claim));
  }

  @PostMapping(ROOT + "/{attemptId}/complete")
  public ApiResponse<Void> complete(
      @RequestHeader("X-NX-Device-Token") String device,
      @PathVariable UUID attemptId,
      @Valid @RequestBody CompleteRequest r) {
    service.complete(
        device,
        attemptId,
        new LocalChapterAnalysis.Completion(
            r.leaseToken(), r.rawJson(), r.usage(), r.adapterVersion(), r.conversationId()));
    return ApiResponse.success("Analysis result accepted");
  }

  @PostMapping(ROOT + "/{attemptId}/validation")
  public ApiResponse<List<LocalChapterAnalysis.Violation>> validate(
      @RequestHeader("X-NX-Device-Token") String device,
      @PathVariable UUID attemptId,
      @Valid @RequestBody ValidationRequest r) {
    return ApiResponse.success(
        "Analysis result checked",
        service.validateStage(
            device,
            attemptId,
            r.leaseToken(),
            r.rawJson(),
            r.windowFirst() == null ? -1 : r.windowFirst(),
            r.windowLast() == null ? -1 : r.windowLast(),
            r.stage(),
            r.canonContext()));
  }

  @PostMapping(ROOT + "/{attemptId}/observation")
  public ApiResponse<Void> observe(
      @RequestHeader("X-NX-Device-Token") String device,
      @PathVariable UUID attemptId,
      @Valid @RequestBody Observation r) {
    service.report(device, attemptId, r.leaseToken(), r.code(), r.ambiguous());
    return ApiResponse.success("Analysis observation accepted");
  }

  @PostMapping(ROOT + "/{attemptId}/progress")
  public ApiResponse<Void> progress(
      @RequestHeader("X-NX-Device-Token") String device,
      @PathVariable UUID attemptId,
      @Valid @RequestBody Progress r) {
    service.progressStage(device, attemptId, r.leaseToken(), r.progress(), r.stage());
    return ApiResponse.success("Analysis progress accepted");
  }

  @PostMapping(ROOT + "/recover")
  public ApiResponse<Void> recover(
      @RequestHeader("X-NX-Device-Token") String device, @Valid @RequestBody Recovery r) {
    service.recoverClaim(device, r.claimRequestId());
    return ApiResponse.success("Recovery recorded");
  }

  @PostMapping(ROOT + "/{attemptId}/cancellation")
  public ApiResponse<Boolean> cancellation(
      @RequestHeader("X-NX-Device-Token") String device,
      @PathVariable UUID attemptId,
      @Valid @RequestBody Lease r) {
    return ApiResponse.success(
        "Cancellation state", service.canceled(device, attemptId, r.leaseToken()));
  }

  public record Settings(
      @NotNull ChapterAnalysisExecutionMode executionMode,
      @NotBlank @Size(max = 128) String model,
      @Pattern(regexp = "LOW|MEDIUM|HIGH") @NotNull String effort,
      @Min(1) @Max(32) int maxConcurrentAnalyses,
      @PositiveOrZero long rowVersion) {}

  public record Registration(
      @NotBlank @Pattern(regexp = "[0-9a-f]{64}") String fingerprint,
      @NotBlank @Size(max = 120) String label,
      @NotBlank @Size(max = 64) String adapterVersion,
      @Size(max = 32) List<@Size(max = 128) String> models) {}

  public record CredentialRegistration(UUID credentialRef, int credentialGeneration) {}

  public record CredentialObservation(
      @NotBlank @Pattern(regexp = "UNKNOWN|CONNECTED|AUTH_REQUIRED|UNAVAILABLE")
          String connectionState,
      @NotBlank @Pattern(regexp = "UNKNOWN|AVAILABLE|RATE_LIMITED|EXHAUSTED") String quotaState,
      Instant nextEligibleAt) {}

  public record ClaimRequest(
      @NotNull UUID claimRequestId,
      @NotNull UUID credentialRef,
      @NotBlank @Size(max = 64) String adapterVersion) {}

  public record Lease(@NotBlank @Size(max = 128) String leaseToken) {}

  public record Progress(
      @NotBlank @Size(max = 128) String leaseToken,
      @Min(0) @Max(99) int progress,
      ChapterAnalysisStage stage) {}

  public record Recovery(@NotNull UUID claimRequestId) {}

  public record Observation(
      @NotBlank @Size(max = 128) String leaseToken,
      @NotBlank @Pattern(regexp = "[A-Z_]{1,80}") String code,
      boolean ambiguous) {}

  public record ValidationRequest(
      @NotBlank @Size(max = 128) String leaseToken,
      @NotBlank @Size(max = 4194304) String rawJson,
      @Min(-1) Integer windowFirst,
      @Min(-1) Integer windowLast,
      ChapterAnalysisStage stage,
      JsonNode canonContext) {
    public ValidationRequest(
        String leaseToken, String rawJson, Integer windowFirst, Integer windowLast) {
      this(leaseToken, rawJson, windowFirst, windowLast, null, null);
    }
  }

  public record CompleteRequest(
      @NotBlank @Size(max = 128) String leaseToken,
      @NotBlank @Size(max = 4194304) String rawJson,
      @NotNull @Valid ChapterAnalysisUsage usage,
      @NotBlank @Size(max = 64) String adapterVersion,
      @Size(max = 200) String conversationId) {}
}
