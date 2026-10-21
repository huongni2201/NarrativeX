package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.api.response.VisualBeatImageAttemptResponse;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.MediaGenerationItemRepository;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSourceAccess;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GetVisualBeatImageAttemptsUseCase {
  private final ChapterAnalysisSourceAccess chapterSourceAccess;
  private final MediaPlanningSourceAccess mediaPlanningSourceAccess;
  private final GenerationJobRepository generationJobRepository;
  private final MediaGenerationItemRepository mediaGenerationItemRepository;

  @Transactional(readOnly = true)
  public List<VisualBeatImageAttemptResponse> execute(
      UUID projectId, UUID chapterId, UUID visualBeatId) {
    chapterSourceAccess.requireForAnalysisLocked(projectId, chapterId);
    var source = mediaPlanningSourceAccess.requireCurrent(chapterId);
    boolean beatIsCurrent =
        source.scenes().stream()
            .flatMap(scene -> scene.beats().stream())
            .anyMatch(beat -> visualBeatId.equals(beat.visualBeatId()));
    if (!beatIsCurrent) throw new ResourceNotFoundException("VisualBeat not found in chapter");

    return mediaGenerationItemRepository
        .findByVisualBeatId(projectId, chapterId, visualBeatId)
        .stream()
        .map(
            item -> {
              var job =
                  generationJobRepository
                      .findById(item.getGenerationJobId())
                      .orElseThrow(
                          () ->
                              new ResourceNotFoundException(
                                  "Image attempt job not found for item " + item.getId()));
              return new VisualBeatImageAttemptResponse(
                  item.getId(),
                  job.getJobId(),
                  item.getMediaPlanId(),
                  job.getStoryboardRevisionId(),
                  source.storyboardRevisionId() != null
                      && source.storyboardRevisionId().equals(job.getStoryboardRevisionId()),
                  item.getAttemptNumber(),
                  item.getExecutionStatus().name(),
                  item.getMediaAssetId(),
                  item.getReviewStatus().name(),
                  item.getReviewedAt(),
                  item.getErrorCode(),
                  item.getRowVersion());
            })
        .toList();
  }
}
