package com.narrativex.backend.feature.generation.application.port.in;

import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.generation.application.service.VisualPromptComposer.ComposedVisualPrompt;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface VisualBeatPromptContext {
  ComposedVisualPrompt get(UUID projectId, UUID chapterId, UUID visualBeatId);

  PreparedVisualBeatPrompt prepare(UUID projectId, UUID chapterId, UUID visualBeatId);

  /**
   * Prepare a set of beats from one consistent read scope. Implementations should override this
   * method to batch storyboard/context reads; the default keeps lightweight test adapters working.
   */
  default Map<UUID, Preparation> prepareMany(
      UUID projectId, UUID chapterId, List<UUID> visualBeatIds) {
    Map<UUID, Preparation> results = new LinkedHashMap<>();
    for (UUID visualBeatId : visualBeatIds) {
      try {
        results.put(
            visualBeatId,
            Preparation.ready(prepare(projectId, chapterId, visualBeatId)));
      } catch (ResourceConflictException conflict) {
        String message =
            conflict.getMessage() == null ? "Generation input conflict" : conflict.getMessage();
        results.put(visualBeatId, Preparation.conflict(message));
      }
    }
    return Map.copyOf(results);
  }

  record Preparation(PreparedVisualBeatPrompt prepared, String conflictMessage) {
    public static Preparation ready(PreparedVisualBeatPrompt prepared) {
      return new Preparation(prepared, null);
    }

    public static Preparation conflict(String message) {
      return new Preparation(null, message);
    }

    public boolean hasConflict() {
      return conflictMessage != null;
    }
  }

  record PreparedVisualBeatPrompt(
      UUID visualBeatId,
      UUID sceneId,
      long beatRowVersion,
      UUID continuityPlanId,
      String continuitySemanticHash,
      ComposedVisualPrompt composedPrompt) {}
}
