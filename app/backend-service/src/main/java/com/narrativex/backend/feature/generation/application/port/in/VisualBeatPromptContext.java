package com.narrativex.backend.feature.generation.application.port.in;

import com.narrativex.backend.feature.generation.application.service.VisualPromptComposer.ComposedVisualPrompt;
import java.util.UUID;

public interface VisualBeatPromptContext {
  ComposedVisualPrompt get(UUID projectId, UUID chapterId, UUID visualBeatId);
}
