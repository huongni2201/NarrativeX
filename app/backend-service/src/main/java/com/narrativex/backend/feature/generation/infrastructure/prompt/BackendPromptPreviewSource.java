package com.narrativex.backend.feature.generation.infrastructure.prompt;

import com.narrativex.backend.feature.character.application.usecase.GetProjectCharacterDetailUseCase;
import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptPreviewResult;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptPreviewTarget;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettings;
import com.narrativex.backend.feature.generation.application.port.out.PromptPreviewSource;
import com.narrativex.backend.feature.generation.application.port.out.ShotLocationContextRepository;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository;
import com.narrativex.backend.feature.generation.application.service.CharacterIdentityPromptComposer;
import com.narrativex.backend.feature.generation.application.service.StoryboardVisualPromptComposer;
import com.narrativex.backend.feature.generation.application.service.VideoLocationContext;
import com.narrativex.backend.feature.generation.application.service.VideoPromptCompiler;
import com.narrativex.backend.feature.generation.application.service.VisualPromptText;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardBeatAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardShotAccess;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Compiles previews through the same composers that admission uses. */
@Component
@RequiredArgsConstructor
public class BackendPromptPreviewSource implements PromptPreviewSource {
  private final GetProjectCharacterDetailUseCase characterDetail;
  private final CharacterIdentityPromptComposer characterComposer;
  private final StoryboardBeatAccess beatAccess;
  private final VisualPromptContextRepository visualPromptContextRepository;
  private final StoryboardVisualPromptComposer storyboardComposer;
  private final StoryboardShotAccess shotAccess;
  private final VideoPromptCompiler videoPromptCompiler;
  private final ShotLocationContextRepository shotLocationContexts;

  @Override
  public PromptPreviewResult preview(PromptSettings settings, PromptPreviewTarget target) {
    return switch (target) {
      case PromptPreviewTarget.Character character -> character(settings, character);
      case PromptPreviewTarget.VisualBeat beat -> visualBeat(settings, beat);
      case PromptPreviewTarget.Shot shot -> shot(settings, shot);
    };
  }

  private PromptPreviewResult character(
      PromptSettings settings, PromptPreviewTarget.Character target) {
    var model = characterDetail.execute(target.projectId(), target.characterId());
    if (model.version() == null) {
      throw new DomainValidationException("target: the character has no pinned version to preview");
    }
    var version = model.version();
    var appearance = model.appearance();
    var composed =
        characterComposer.compose(
            settings,
            model.canonicalName(),
            version.visualPrompt(),
            version.bible(),
            appearance == null ? null : appearance.appearancePrompt(),
            appearance == null ? null : appearance.ageState(),
            appearance == null ? null : appearance.hairstyle(),
            appearance == null ? null : appearance.injury());
    return new PromptPreviewResult(
        composed.prompt(),
        composed.negativePrompt(),
        VisualPromptText.finalPrompt(composed.prompt(), composed.negativePrompt()));
  }

  private PromptPreviewResult visualBeat(
      PromptSettings settings, PromptPreviewTarget.VisualBeat target) {
    var beat =
        beatAccess.requireCurrentBeats(target.projectId(), target.chapterId()).stream()
            .filter(candidate -> candidate.getId().equals(target.visualBeatId()))
            .findFirst()
            .orElseThrow(
                () ->
                    new ResourceNotFoundException(
                        "Visual Beat not found in the current Chapter storyboard"));
    var context = visualPromptContextRepository.findForBeat(target.projectId(), beat.getId());
    String aspectRatio =
        beat.getAspectRatioOverride() == null ? null : beat.getAspectRatioOverride().name();
    var composed =
        storyboardComposer.compose(
            settings, beat.getVisualIntent(), beat.getVisualDirectionJson(), aspectRatio, context);
    return new PromptPreviewResult(
        composed.prompt(), composed.negativePrompt(), VisualPromptText.finalPrompt(composed));
  }

  private PromptPreviewResult shot(PromptSettings settings, PromptPreviewTarget.Shot target) {
    var shot =
        shotAccess
            .findShotById(target.projectId(), target.shotId())
            .orElseThrow(() -> new ResourceNotFoundException("Shot not found"));
    // Same Location resolution as Take admission, so the preview shows the prompt that is sent.
    var location =
        VideoLocationContext.from(
            shotLocationContexts.findForShot(target.projectId(), target.shotId()));
    var compiled = videoPromptCompiler.compile(shot, settings, null, location);
    String negative = compiled.negativePrompt() == null ? "" : compiled.negativePrompt();
    return new PromptPreviewResult(compiled.prompt(), negative, compiled.prompt());
  }
}
