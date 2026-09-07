package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.request.AnalyzeChapterRequest;
import com.narrativex.backend.feature.generation.api.request.GenerateBatchNarrationRequest;
import com.narrativex.backend.feature.generation.api.request.GenerateChapterNarrationRequest;
import com.narrativex.backend.feature.generation.api.request.GenerateVoicePreviewRequest;
import com.narrativex.backend.feature.generation.api.request.PrepareStoryboardGenerationBatchRequest;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.api.response.StoryboardGenerationBatchResponse;
import com.narrativex.backend.feature.generation.api.response.VisualBeatGeminiContextResponse;
import com.narrativex.backend.feature.generation.api.response.VoicePreviewResultResponse;
import com.narrativex.backend.feature.generation.application.command.EnqueueStoryAnalysisCommand;
import com.narrativex.backend.feature.generation.application.command.GenerateBatchNarrationCommand;
import com.narrativex.backend.feature.generation.application.command.GenerateChapterNarrationCommand;
import com.narrativex.backend.feature.generation.application.port.in.VisualBeatPromptContext;
import com.narrativex.backend.feature.generation.application.usecase.EnqueueStoryAnalysisUseCase;
import com.narrativex.backend.feature.generation.application.usecase.GenerateBatchNarrationUseCase;
import com.narrativex.backend.feature.generation.application.usecase.GenerateChapterNarrationUseCase;
import com.narrativex.backend.feature.generation.application.usecase.GetVoicePreviewResultUseCase;
import com.narrativex.backend.feature.generation.application.usecase.PrepareStoryboardGenerationBatchUseCase;
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
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.ObjectMapper;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/projects")
public class ProjectGenerationController {
  private final EnqueueStoryAnalysisUseCase enqueueStoryAnalysisUseCase;
  private final GenerateChapterNarrationUseCase generateChapterNarrationUseCase;
  private final GenerateBatchNarrationUseCase generateBatchNarrationUseCase;
  private final GetVoicePreviewResultUseCase getVoicePreviewResultUseCase;
  private final VisualBeatPromptContext visualBeatPromptContext;
  private final PrepareStoryboardGenerationBatchUseCase prepareStoryboardGenerationBatchUseCase;
  private final ObjectMapper objectMapper;

  @PostMapping("/{projectId}/chapters/{chapterId}/analysis-jobs")
  public ResponseEntity<ApiResponse<JobResponse>> analyzeChapter(
      @PathVariable UUID projectId,
      @PathVariable UUID chapterId,
      @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
      @Valid @RequestBody(required = false) AnalyzeChapterRequest request) {
    AnalyzeChapterRequest effective =
        request == null ? new AnalyzeChapterRequest(null, null) : request;
    log.info(
        "Requesting story analysis for chapter {} in project {} (visualMode={}, imageProvider={})",
        chapterId,
        projectId,
        effective.effectiveVisualGenerationMode(),
        effective.effectiveImageProvider());
    var job =
        enqueueStoryAnalysisUseCase.execute(
            new EnqueueStoryAnalysisCommand(
                projectId,
                chapterId,
                effective.effectiveVisualGenerationMode(),
                effective.effectiveImageProvider(),
                idempotencyKey));
    return ResponseEntity.status(HttpStatus.ACCEPTED)
        .body(ApiResponse.success("Story analysis job accepted", JobResponse.from(job)));
  }

  public ResponseEntity<ApiResponse<JobResponse>> analyzeChapter(UUID projectId, UUID chapterId) {
    return analyzeChapter(projectId, chapterId, null, null);
  }

  @GetMapping("/{projectId}/chapters/{chapterId}/visual-beats/{visualBeatId}/gemini-context")
  public ResponseEntity<ApiResponse<VisualBeatGeminiContextResponse>> getVisualBeatGeminiContext(
      @PathVariable UUID projectId, @PathVariable UUID chapterId, @PathVariable UUID visualBeatId) {
    var composedPrompt = visualBeatPromptContext.get(projectId, chapterId, visualBeatId);
    return ResponseEntity.ok(
        ApiResponse.success(
            "Gemini Visual Beat prompt context retrieved",
            VisualBeatGeminiContextResponse.from(visualBeatId, composedPrompt)));
  }

  @PostMapping("/{projectId}/chapters/{chapterId}/gemini-generation-batches:prepare")
  public ResponseEntity<ApiResponse<StoryboardGenerationBatchResponse>> prepareStoryboardGenerationBatch(
      @PathVariable UUID projectId,
      @PathVariable UUID chapterId,
      @RequestHeader("Idempotency-Key") String idempotencyKey,
      @Valid @RequestBody PrepareStoryboardGenerationBatchRequest request) {
    var prepared =
        prepareStoryboardGenerationBatchUseCase.execute(
            projectId,
            chapterId,
            request.beatIds(),
            request.expectedStoryboardRevisionId(),
            idempotencyKey);
    return ResponseEntity.ok(
        ApiResponse.success(
            "Storyboard generation batch prepared",
            StoryboardGenerationBatchResponse.from(prepared, objectMapper)));
  }

  @GetMapping("/{projectId}/chapters/{chapterId}/gemini-generation-batches/{batchId}")
  public ResponseEntity<ApiResponse<StoryboardGenerationBatchResponse>> getStoryboardGenerationBatch(
      @PathVariable UUID projectId,
      @PathVariable UUID chapterId,
      @PathVariable UUID batchId) {
    var prepared = prepareStoryboardGenerationBatchUseCase.get(projectId, chapterId, batchId);
    return ResponseEntity.ok(
        ApiResponse.success(
            "Storyboard generation batch retrieved",
            StoryboardGenerationBatchResponse.from(prepared, objectMapper)));
  }

  @PostMapping("/{projectId}/chapters/{chapterId}/narration-jobs")
  public ResponseEntity<ApiResponse<JobResponse>> narrateChapter(
      @PathVariable UUID projectId,
      @PathVariable UUID chapterId,
      @RequestParam(defaultValue = "false") boolean forceRegenerate,
      @Valid @RequestBody GenerateChapterNarrationRequest request) {
    log.info(
        "Requesting narration for chapter {} in project {} (forceRegenerate={})",
        chapterId,
        projectId,
        forceRegenerate);
    var job =
        generateChapterNarrationUseCase.execute(
            new GenerateChapterNarrationCommand(
                projectId,
                chapterId,
                request.voiceId(),
                request.effectiveSpeakingRate(),
                request.voiceReference(),
                forceRegenerate));
    return ResponseEntity.status(HttpStatus.ACCEPTED)
        .body(ApiResponse.success("Narration job accepted", JobResponse.from(job)));
  }

  @PostMapping("/{projectId}/voice-preview-jobs")
  public ResponseEntity<ApiResponse<JobResponse>> previewVoice(
      @PathVariable UUID projectId, @Valid @RequestBody GenerateVoicePreviewRequest request) {
    log.info(
        "Requesting voice preview for chapter {} in project {} with reference {}",
        request.chapterId(),
        projectId,
        request.voiceReference());
    var job =
        generateChapterNarrationUseCase.execute(
            new GenerateChapterNarrationCommand(
                projectId,
                request.chapterId(),
                request.voiceId(),
                request.effectiveSpeakingRate(),
                request.voiceReference(),
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
            VoicePreviewResultResponse.from(
                getVoicePreviewResultUseCase.execute(projectId, jobId))));
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
                request.voiceReference()));
    var response =
        jobs.stream()
            .map(
                item ->
                    new BatchNarrationJobResponse(item.chapterId(), JobResponse.from(item.job())))
            .toList();
    return ResponseEntity.status(HttpStatus.ACCEPTED)
        .body(ApiResponse.success("Narration jobs accepted", response));
  }

  public record BatchNarrationJobResponse(UUID chapterId, JobResponse job) {}
}
