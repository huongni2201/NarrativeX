package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.request.GenerateChapterNarrationRequest;
import com.narrativex.backend.feature.generation.api.request.ConfirmChapterTranslationRequest;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.application.command.EnqueueStoryAnalysisCommand;
import com.narrativex.backend.feature.generation.application.command.ConfirmChapterTranslationCommand;
import com.narrativex.backend.feature.generation.application.command.GenerateChapterNarrationCommand;
import com.narrativex.backend.feature.generation.application.usecase.EnqueueStoryAnalysisUseCase;
import com.narrativex.backend.feature.generation.application.usecase.GenerateChapterNarrationUseCase;
import com.narrativex.backend.feature.generation.application.usecase.ConfirmChapterTranslationUseCase;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Autowired;
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
  private final ConfirmChapterTranslationUseCase confirmChapterTranslationUseCase;

  @Autowired
  public ProjectGenerationController(
      EnqueueStoryAnalysisUseCase enqueueStoryAnalysisUseCase,
      GenerateChapterNarrationUseCase generateChapterNarrationUseCase,
      ConfirmChapterTranslationUseCase confirmChapterTranslationUseCase) {
    this.enqueueStoryAnalysisUseCase = enqueueStoryAnalysisUseCase;
    this.generateChapterNarrationUseCase = generateChapterNarrationUseCase;
    this.confirmChapterTranslationUseCase = confirmChapterTranslationUseCase;
  }

  public ProjectGenerationController(
      EnqueueStoryAnalysisUseCase enqueueStoryAnalysisUseCase,
      GenerateChapterNarrationUseCase generateChapterNarrationUseCase) {
    this(enqueueStoryAnalysisUseCase, generateChapterNarrationUseCase, null);
  }

  @PostMapping("/{projectId}/chapters/{chapterId}/analysis-jobs")
  public ResponseEntity<ApiResponse<JobResponse>> analyzeChapter(
      @PathVariable Long projectId,
      @PathVariable Long chapterId,
      @RequestParam(required = false) Long contentVariantId) {
    log.info("Requesting story analysis for chapter {} in project {}", chapterId, projectId);
    var job =
        enqueueStoryAnalysisUseCase.execute(new EnqueueStoryAnalysisCommand(projectId, chapterId, contentVariantId));
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

  public ResponseEntity<ApiResponse<JobResponse>> analyzeChapter(Long projectId, Long chapterId) {
    return analyzeChapter(projectId, chapterId, null);
  }

  @PostMapping("/{projectId}/chapters/{chapterId}/translations")
  public ResponseEntity<ApiResponse<JobResponse>> translateChapter(
      @PathVariable Long projectId,
      @PathVariable Long chapterId,
      @Valid @RequestBody ConfirmChapterTranslationRequest request) {
    var job = confirmChapterTranslationUseCase.execute(new ConfirmChapterTranslationCommand(
        projectId, chapterId, request.sourceVariantId(), request.sourceContentHash(),
        request.targetLanguage()));
    return ResponseEntity.status(HttpStatus.ACCEPTED)
        .body(ApiResponse.success("Chapter translation job accepted", JobResponse.from(job)));
  }
}
