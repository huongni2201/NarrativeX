package com.narrativex.backend.feature.storyboard.application.port.out;

import com.narrativex.backend.feature.storyboard.domain.entity.VisualBeat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Provides the server-composed final prompt for Visual Beat read models. */
public interface VisualBeatPromptProvider {
  String promptFor(UUID projectId, VisualBeat visualBeat);

  default Map<UUID, String> promptsFor(UUID projectId, List<VisualBeat> visualBeats) {
    Map<UUID, String> prompts = new LinkedHashMap<>();
    for (VisualBeat visualBeat : visualBeats) {
      prompts.put(visualBeat.getId(), promptFor(projectId, visualBeat));
    }
    return Map.copyOf(prompts);
  }
}
