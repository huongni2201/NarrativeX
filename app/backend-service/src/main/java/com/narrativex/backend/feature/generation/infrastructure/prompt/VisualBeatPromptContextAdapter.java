package com.narrativex.backend.feature.generation.infrastructure.prompt;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.port.in.VisualBeatPromptContext;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository;
import com.narrativex.backend.feature.generation.application.service.VisualPromptComposer.ComposedVisualPrompt;
import com.narrativex.backend.feature.generation.application.service.VisualPromptComposerV3;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import com.narrativex.backend.feature.storyboard.application.usecase.GetChapterStoryboardUseCase;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class VisualBeatPromptContextAdapter implements VisualBeatPromptContext {
  private final GetChapterStoryboardUseCase getChapterStoryboardUseCase;
  private final VisualPromptContextRepository visualPromptContextRepository;
  private final VisualPromptComposerV3 visualPromptComposer;

  @Override
  public ComposedVisualPrompt get(UUID projectId, UUID chapterId, UUID visualBeatId) {
    var storyboard = getChapterStoryboardUseCase.execute(projectId, chapterId).data();
    var beat =
        storyboard.scenes().stream()
            .flatMap(scene -> scene.visualBeats().stream())
            .filter(candidate -> candidate.id().equals(visualBeatId))
            .findFirst()
            .orElseThrow(
                () ->
                    new ResourceNotFoundException(
                        "Visual Beat not found in the current Chapter storyboard"));
    var context = visualPromptContextRepository.findForBeat(projectId, visualBeatId);
    String aspectRatio =
        beat.aspectRatioOverride() == null ? null : beat.aspectRatioOverride().name();
    return visualPromptComposer.compose(
        ImageStyle.CINEMATIC_ANIME,
        beat.visualIntent(),
        beat.visualDirectionJson(),
        aspectRatio,
        context);
  }
}
