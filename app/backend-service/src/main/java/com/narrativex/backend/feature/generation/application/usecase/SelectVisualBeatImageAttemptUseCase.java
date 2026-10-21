package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.MediaGenerationItemRepository;
import com.narrativex.backend.feature.generation.domain.enums.MediaGenerationExecutionStatus;
import com.narrativex.backend.feature.generation.domain.enums.MediaGenerationReviewStatus;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SelectVisualBeatImageAttemptUseCase {
  private final ChapterAnalysisSourceAccess chapterSourceAccess;
  private final MediaPlanningSourceAccess mediaPlanningSourceAccess;
  private final GenerationJobRepository generationJobRepository;
  private final MediaGenerationItemRepository mediaGenerationItemRepository;
  private final StoryboardProductionAccess storyboardAccess;

  @Transactional(readOnly = true)
  public Selection execute(UUID projectId, UUID chapterId, UUID visualBeatId, UUID itemId) {
    chapterSourceAccess.requireForAnalysisLocked(projectId, chapterId);
    var source = mediaPlanningSourceAccess.requireCurrent(chapterId);
    boolean beatIsCurrent =
        source.scenes().stream()
            .flatMap(scene -> scene.beats().stream())
            .anyMatch(beat -> visualBeatId.equals(beat.visualBeatId()));
    if (!beatIsCurrent) throw new ResourceNotFoundException("VisualBeat not found in chapter");

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
    if (!Objects.equals(source.storyboardRevisionId(), job.getStoryboardRevisionId())) {
      throw new GenerationAdmissionDeniedException(
          "STALE_STORYBOARD_REVISION",
          "This image was generated from an older storyboard revision.");
    }
    if (item.getExecutionStatus() != MediaGenerationExecutionStatus.READY
        || item.getReviewStatus() != MediaGenerationReviewStatus.APPROVED
        || item.getMediaAssetId() == null) {
      throw new GenerationAdmissionDeniedException(
          "IMAGE_ATTEMPT_NOT_APPROVED", "Only a READY, approved image attempt can be selected.");
    }
    var visualBeat =
        storyboardAccess
            .findVisualBeat(visualBeatId)
            .orElseThrow(() -> new ResourceNotFoundException("VisualBeat not found"));
    return new Selection(visualBeat.sceneId(), item.getMediaAssetId());
  }

  public record Selection(UUID sceneId, UUID mediaAssetId) {}
}
