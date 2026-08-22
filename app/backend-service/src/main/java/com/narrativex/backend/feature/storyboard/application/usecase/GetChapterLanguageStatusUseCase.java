package com.narrativex.backend.feature.storyboard.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.api.response.ChapterLanguageStatusResponse;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterContentVariantRepository;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import com.narrativex.backend.feature.storyboard.application.port.out.LanguageDetectionRepository;
import com.narrativex.backend.feature.storyboard.application.service.ChapterLanguagePolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GetChapterLanguageStatusUseCase {
  private final CurrentUserId currentUserId;
  private final ChapterRepository chapterRepository;
  private final StoryVersionAccess storyVersionAccess;
  private final ProjectAccess projectAccess;
  private final ChapterContentVariantRepository variantRepository;
  private final LanguageDetectionRepository detectionRepository;

  @Transactional(readOnly = true)
  public ApiResponse<ChapterLanguageStatusResponse> execute(Long projectId, Long chapterId) {
    var chapter = chapterRepository.findById(chapterId).orElseThrow(() -> new ResourceNotFoundException("Chapter not found"));
    storyVersionAccess.requireOwnedStoryVersion(projectId, chapter.getStoryVersionId(), currentUserId.get());
    var project = projectAccess.findOwnedProject(projectId, currentUserId.get());
    var variant = variantRepository.findLatestOriginal(chapterId).orElseThrow(() -> new ResourceNotFoundException("Chapter content variant not found"));
    var detection = detectionRepository.findLatest(variant.id(), variant.contentHash()).orElse(null);
    String status = ChapterLanguagePolicy.translationStatus(detection, project.getProjectLanguage());
    Long translationId = detection == null ? null : variantRepository
        .findCompletedTranslation(chapterId, variant.id(), project.getProjectLanguage(), variant.contentHash())
        .map(v -> v.id()).orElse(null);
    if (translationId != null) status = "COMPLETED";
    return ApiResponse.success(new ChapterLanguageStatusResponse(
        variant.id(), detection == null ? null : detection.detectedLanguage(),
        detection == null ? null : detection.confidence(), detection == null ? null : detection.detector(),
        project.getProjectLanguage(), status, translationId));
  }
}
