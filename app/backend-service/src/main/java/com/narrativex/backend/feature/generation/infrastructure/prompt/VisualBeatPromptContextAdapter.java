package com.narrativex.backend.feature.generation.infrastructure.prompt;

import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.port.in.VisualBeatPromptContext;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository;
import com.narrativex.backend.feature.generation.application.service.VisualPromptComposer;
import com.narrativex.backend.feature.generation.application.service.VisualPromptComposer.ComposedVisualPrompt;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import com.narrativex.backend.feature.storyboard.application.usecase.GetChapterStoryboardUseCase;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class VisualBeatPromptContextAdapter implements VisualBeatPromptContext {
  private static final int MAX_REFERENCE_IMAGES = 3;

  private final GetChapterStoryboardUseCase getChapterStoryboardUseCase;
  private final VisualPromptContextRepository visualPromptContextRepository;
  private final VisualPromptComposer visualPromptComposer;

  @Override
  public ComposedVisualPrompt get(UUID projectId, UUID chapterId, UUID visualBeatId) {
    return prepare(projectId, chapterId, visualBeatId).composedPrompt();
  }

  @Override
  public PreparedVisualBeatPrompt prepare(UUID projectId, UUID chapterId, UUID visualBeatId) {
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
    long requiredIdentityReferences =
        context.characters().stream().filter(character -> !character.references().isEmpty()).count();
    if (requiredIdentityReferences > MAX_REFERENCE_IMAGES) {
      throw new ResourceConflictException(
          "REFERENCE_BUDGET_EXCEEDED: Visual Beat requires identity references for "
              + requiredIdentityReferences
              + " participating characters but Gemini Web supports at most "
              + MAX_REFERENCE_IMAGES
              + ".");
    }
    String aspectRatio =
        beat.aspectRatioOverride() == null ? null : beat.aspectRatioOverride().name();
    var composed =
        visualPromptComposer.compose(
            ImageStyle.CINEMATIC_ANIME,
            beat.visualIntent(),
            beat.visualDirectionJson(),
            aspectRatio,
            context);
    var continuity = context.continuity();
    return new PreparedVisualBeatPrompt(
        beat.id(),
        beat.sceneId(),
        beat.rowVersion(),
        continuity == null ? null : continuity.planId(),
        continuity == null ? null : continuity.semanticHash(),
        composed);
  }
}
