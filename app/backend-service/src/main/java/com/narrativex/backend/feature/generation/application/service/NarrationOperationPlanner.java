package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.domain.enums.NarrationStrategy;
import java.util.List;
import org.springframework.stereotype.Component;

/** Conditional pipeline planning: uploaded audio never creates a TTS stage. */
@Component
public class NarrationOperationPlanner {
  public List<Stage> plan(NarrationStrategy strategy) {
    if (strategy == null) throw new IllegalArgumentException("strategy must not be null");
    if (strategy == NarrationStrategy.TTS) {
      return List.of(
          Stage.CHAPTER_ANALYZE,
          Stage.TTS_GENERATE,
          Stage.AUDIO_ALIGN,
          Stage.VISUAL_PLAN,
          Stage.IMAGE_GENERATE,
          Stage.MOTION,
          Stage.RENDER);
    }
    return List.of(
        Stage.CHAPTER_ANALYZE,
        Stage.AUDIO_ALIGN,
        Stage.VISUAL_PLAN,
        Stage.IMAGE_GENERATE,
        Stage.MOTION,
        Stage.RENDER);
  }

  public boolean includesTts(NarrationStrategy strategy) {
    return plan(strategy).contains(Stage.TTS_GENERATE);
  }

  public enum Stage {
    CHAPTER_ANALYZE,
    TTS_GENERATE,
    AUDIO_ALIGN,
    VISUAL_PLAN,
    IMAGE_GENERATE,
    MOTION,
    RENDER
  }
}
