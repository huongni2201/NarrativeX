package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.request.AnalyzeChapterRequest;
import com.narrativex.backend.feature.generation.api.request.GenerateBatchNarrationRequest;
import com.narrativex.backend.feature.generation.api.request.GenerateChapterNarrationRequest;
import com.narrativex.backend.feature.generation.api.request.GenerateVoicePreviewRequest;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.api.response.VoicePreviewResultResponse;
import com.narrativex.backend.feature.generation.application.command.EnqueueStoryAnalysisCommand;
import com.narrativex.backend.feature.generation.application.command.GenerateBatchNarrationCommand;
import com.narrativex.backend.feature.generation.application.command.GenerateChapterNarrationCommand;
import com.narrativex.backend.feature.generation.application.usecase.EnqueueStoryAnalysisUseCase;
import com.narrativex.backend.feature.generation.application.usecase.GenerateBatchNarrationUseCase;
import com.narrativex.backend.feature.generation.application.usecase.GenerateChapterNarrationUseCase;
import com.narrativex.backend.feature.generation.application.usecase.GetVoicePreviewResultUseCase;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/projects")
public class ProjectGenerationController {
  private final EnqueueStoryAnalysisUseCase enqueueStoryAnalysisUseCase;
  private final GenerateChapterNarrationUseCase generateChapterNarrationUseCase;
  private final GenerateBatchNarrationUseCase generateBatchNarrationUseCase;
  private final GetVoicePreviewResultUseCase getVoicePreviewResultUseCase;

  @PostMapping("/{projectId}/chapters/{chapterId}/analysis-jobs")
  public ResponseEntity<ApiResponse<JobResponse>> analyzeChapter(
      @PathVariable UUID projectId,
      @PathVariable UUID chapterId,
      @RequestBody(required = false) AnalyzeChapterRequest request) {
    ProductionMode productionMode =
        request == null ? ProductionMode.IMAGE_MOTION : request.effectiveProductionMode();
    log.info(
        "Requesting story analysis for chapter {} in project {} with productionMode={}",
        chapterId,
        projectId,
        productionMode);
    var job =
        enqueueStoryAnalysisUseCase.execute(
            new EnqueueStoryAnalysisCommand(projectId, chapterId, productionMode));
    return ResponseEntity.status(HttpStatus.ACCEPTED)
        .body(ApiResponse.success("Story analysis job accepted", JobResponse.from(job)));
  }

  @PostMapping("/{projectId}/chapters/{chapterId}/narration-jobs")
  public ResponseEntity<ApiResponse<JobResponse>> narrateChapter(
      @PathVariable UUID projectId,
      @PathVariable UUID chapterId,
      @Valid @RequestBody GenerateChapterNarrationRequest request) {
    log.info("Requesting narration for chapter {} in project {}", chapterId, projectId);
    var job =
        generateChapterNarrationUseCase.execute(
            new GenerateChapterNarrationCommand(
                projectId,
                chapterId,
                request.voiceId(),
                request.effectiveSpeakingRate(),
                request.voiceReferenceAssetId()));
    return ResponseEntity.status(HttpStatus.ACCEPTED)
        .body(ApiResponse.success("Narration job accepted", JobResponse.from(job)));
  }

  @PostMapping("/{projectId}/voice-preview-jobs")
  public ResponseEntity<ApiResponse<JobResponse>> previewVoice(
      @PathVariable UUID projectId, @Valid @RequestBody GenerateVoicePreviewRequest request) {
    log.info(
        "Requesting voice preview for chapter {} in project {} with reference asset {}",
        request.chapterId(),
        projectId,
        request.voiceReferenceAssetId());
    var job =
        generateChapterNarrationUseCase.execute(
            new GenerateChapterNarrationCommand(
                projectId,
                request.chapterId(),
                request.voiceId(),
                request.effectiveSpeakingRate(),
                request.voiceReferenceAssetId(),
                request.sampleText()));
    return ResponseEntity.status(HttpStatus.ACCEPTED)
        .body(ApiResponse.success("Voice preview job accepted", JobResponse.from(job)));
  }

  @GetMapping("/{projectId}/voice-preview-jobs/{jobId}/result")
  public ResponseEntity<ApiResponse<VoicePreviewResultResponse>> getVoicePreviewResult(
      @PathVariable UUID projectId, @PathVariable UUID jobId) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Voice preview result retrieved",
            VoicePreviewResultResponse.from(getVoicePreviewResultUseCase.execute(projectId, jobId))));
  }

  @PostMapping("/{projectId}/narration-jobs:batch")
  public ResponseEntity<ApiResponse<List<BatchNarrationJobResponse>>> narrateChapters(
      @PathVariable UUID projectId, @Valid @RequestBody GenerateBatchNarrationRequest request) {
    var jobs =
        generateBatchNarrationUseCase.execute(
            new GenerateBatchNarrationCommand(
                projectId,
                request.chapterIds(),
                request.voiceId(),
                request.effectiveSpeakingRate(),
                request.voiceReferenceAssetId()));
    var response =
        jobs.stream()
            .map(item -> new BatchNarrationJobResponse(item.chapterId(), JobResponse.from(item.job())))
            .toList();
    return ResponseEntity.status(HttpStatus.ACCEPTED)
        .body(ApiResponse.success("Narration jobs accepted", response));
  }

  public record BatchNarrationJobResponse(UUID chapterId, JobResponse job) {}
}
