package com.narrativex.backend.feature.generation.application.port.in;

import com.narrativex.backend.feature.generation.application.service.VisualPromptComposer.ComposedVisualPrompt;
import java.util.UUID;

public interface VisualBeatPromptContext {
  ComposedVisualPrompt get(UUID projectId, UUID chapterId, UUID visualBeatId);

  PreparedVisualBeatPrompt prepare(UUID projectId, UUID chapterId, UUID visualBeatId);

  record PreparedVisualBeatPrompt(
      UUID visualBeatId,
      UUID sceneId,
      long beatRowVersion,
      UUID continuityPlanId,
      String continuitySemanticHash,
      ComposedVisualPrompt composedPrompt) {}
}
