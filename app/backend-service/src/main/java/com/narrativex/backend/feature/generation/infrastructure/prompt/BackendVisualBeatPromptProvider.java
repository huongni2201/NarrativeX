package com.narrativex.backend.feature.generation.infrastructure.prompt;

import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository;
import com.narrativex.backend.feature.generation.application.service.VisualPromptComposer;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import com.narrativex.backend.feature.storyboard.application.port.out.VisualBeatPromptProvider;
import com.narrativex.backend.feature.storyboard.domain.entity.VisualBeat;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Bridges the Storyboard prompt port to the authoritative generation prompt composer. */
@Component
@RequiredArgsConstructor
public class BackendVisualBeatPromptProvider implements VisualBeatPromptProvider {
  private final VisualPromptComposer visualPromptComposer;
  private final VisualPromptContextRepository visualPromptContextRepository;

  @Override
  public String promptFor(UUID projectId, VisualBeat visualBeat) {
    var context =
        visualPromptContextRepository.findForScene(projectId, visualBeat.getSceneId());
    return visualPromptComposer
        .compose(
            ImageStyle.CINEMATIC,
            visualBeat.getVisualIntent(),
            visualBeat.getCameraAngle().name(),
            context)
        .prompt();
  }
}
