package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.MediaGenerationItemRepository;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSourceAccess;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ReviewVisualBeatImageAttemptUseCase {
  private final ChapterAnalysisSourceAccess chapterSourceAccess;
  private final MediaPlanningSourceAccess mediaPlanningSourceAccess;
  private final GenerationJobRepository generationJobRepository;
  private final MediaGenerationItemRepository mediaGenerationItemRepository;

  @Transactional
  public void execute(
      UUID projectId,
      UUID chapterId,
      UUID visualBeatId,
      UUID itemId,
      String decision,
      long rowVersion) {
    var source = requireCurrentBeat(projectId, chapterId, visualBeatId);
    var item =
        mediaGenerationItemRepository
            .findById(itemId)
            .orElseThrow(() -> new ResourceNotFoundException("Image attempt not found"));
    if (!visualBeatId.equals(item.getVisualBeatId()) || item.getShotId() != null) {
      throw new ResourceNotFoundException("Image attempt not found for this VisualBeat");
    }
    var job =
        generationJobRepository
            .findById(item.getGenerationJobId())
            .orElseThrow(() -> new ResourceNotFoundException("Image attempt job not found"));
    if (!projectId.equals(job.getProjectId()) || !chapterId.equals(job.getChapterId())) {
      throw new ResourceNotFoundException("Image attempt not found in this project and chapter");
    }
    if ("APPROVED".equals(decision)
        && !java.util.Objects.equals(
            source.storyboardRevisionId(), job.getStoryboardRevisionId())) {
      throw new GenerationAdmissionDeniedException(
          "STALE_STORYBOARD_REVISION",
          "Review the current VisualBeat revision before approving this image.");
    }
    if (!mediaGenerationItemRepository.review(itemId, rowVersion, decision)) {
      throw new GenerationAdmissionDeniedException(
          "ASSET_REVIEW_REQUIRED", "The item changed or is no longer awaiting review.");
    }
  }

  private com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource
      requireCurrentBeat(UUID projectId, UUID chapterId, UUID visualBeatId) {
    chapterSourceAccess.requireForAnalysisLocked(projectId, chapterId);
    var source = mediaPlanningSourceAccess.requireCurrent(chapterId);
    boolean beatIsCurrent =
        source.scenes().stream()
            .flatMap(scene -> scene.beats().stream())
            .anyMatch(beat -> visualBeatId.equals(beat.visualBeatId()));
    if (!beatIsCurrent) throw new ResourceNotFoundException("VisualBeat not found in chapter");
    return source;
  }
}
