package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.request.ConfirmChapterTranslationRequest;
import com.narrativex.backend.feature.generation.api.request.GenerateBatchNarrationRequest;
import com.narrativex.backend.feature.generation.api.request.GenerateChapterNarrationRequest;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.application.command.ConfirmChapterTranslationCommand;
import com.narrativex.backend.feature.generation.application.command.EnqueueStoryAnalysisCommand;
import com.narrativex.backend.feature.generation.application.command.GenerateBatchNarrationCommand;
import com.narrativex.backend.feature.generation.application.command.GenerateChapterNarrationCommand;
import com.narrativex.backend.feature.generation.application.usecase.ConfirmChapterTranslationUseCase;
import com.narrativex.backend.feature.generation.application.usecase.EnqueueStoryAnalysisUseCase;
import com.narrativex.backend.feature.generation.application.usecase.GenerateBatchNarrationUseCase;
import com.narrativex.backend.feature.generation.application.usecase.GenerateChapterNarrationUseCase;
import jakarta.validation.Valid;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/v1/projects")
public class ProjectGenerationController {
  private final EnqueueStoryAnalysisUseCase enqueueStoryAnalysisUseCase;
  private final GenerateChapterNarrationUseCase generateChapterNarrationUseCase;
  private final GenerateBatchNarrationUseCase generateBatchNarrationUseCase;
  private final ConfirmChapterTranslationUseCase confirmChapterTranslationUseCase;

  @Autowired
  public ProjectGenerationController(
      EnqueueStoryAnalysisUseCase enqueueStoryAnalysisUseCase,
      GenerateChapterNarrationUseCase generateChapterNarrationUseCase,
      GenerateBatchNarrationUseCase generateBatchNarrationUseCase,
      ConfirmChapterTranslationUseCase confirmChapterTranslationUseCase) {
    this.enqueueStoryAnalysisUseCase = enqueueStoryAnalysisUseCase;
    this.generateChapterNarrationUseCase = generateChapterNarrationUseCase;
    this.generateBatchNarrationUseCase = generateBatchNarrationUseCase;
    this.confirmChapterTranslationUseCase = confirmChapterTranslationUseCase;
  }

  public ProjectGenerationController(
      EnqueueStoryAnalysisUseCase enqueueStoryAnalysisUseCase,
      GenerateChapterNarrationUseCase generateChapterNarrationUseCase) {
    this(enqueueStoryAnalysisUseCase, generateChapterNarrationUseCase, null, null);
  }

  @PostMapping("/{projectId}/chapters/{chapterId}/analysis-jobs")
  public ResponseEntity<ApiResponse<JobResponse>> analyzeChapter(
      @PathVariable Long projectId,
      @PathVariable Long chapterId,
      @RequestParam(required = false) Long contentVariantId) {
    log.info("Requesting story analysis for chapter {} in project {}", chapterId, projectId);
    var job =
        enqueueStoryAnalysisUseCase.execute(
            new EnqueueStoryAnalysisCommand(projectId, chapterId, contentVariantId));
    return ResponseEntity.status(HttpStatus.ACCEPTED)
        .body(ApiResponse.success("Story analysis job accepted", JobResponse.from(job)));
  }

  @PostMapping("/{projectId}/chapters/{chapterId}/narration-jobs")
  public ResponseEntity<ApiResponse<JobResponse>> narrateChapter(
      @PathVariable Long projectId,
      @PathVariable Long chapterId,
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

  @PostMapping("/{projectId}/narration-jobs:batch")
  public ResponseEntity<ApiResponse<List<BatchNarrationJobResponse>>> narrateChapters(
      @PathVariable Long projectId,
      @Valid @RequestBody GenerateBatchNarrationRequest request) {
    if (generateBatchNarrationUseCase == null) {
      throw new IllegalStateException("Batch narration use case is not configured");
    }
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

  public ResponseEntity<ApiResponse<JobResponse>> analyzeChapter(Long projectId, Long chapterId) {
    return analyzeChapter(projectId, chapterId, null);
  }

  @PostMapping("/{projectId}/chapters/{chapterId}/translations")
  public ResponseEntity<ApiResponse<JobResponse>> translateChapter(
      @PathVariable Long projectId,
      @PathVariable Long chapterId,
      @Valid @RequestBody ConfirmChapterTranslationRequest request) {
    if (confirmChapterTranslationUseCase == null) {
      throw new IllegalStateException("Translation use case is not configured");
    }
    var job =
        confirmChapterTranslationUseCase.execute(
            new ConfirmChapterTranslationCommand(
                projectId,
                chapterId,
                request.sourceVariantId(),
                request.sourceContentHash(),
                request.targetLanguage()));
    return ResponseEntity.status(HttpStatus.ACCEPTED)
        .body(ApiResponse.success("Chapter translation job accepted", JobResponse.from(job)));
  }

  public record BatchNarrationJobResponse(Long chapterId, JobResponse job) {}
}
