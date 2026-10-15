package com.narrativex.backend.feature.generation.application.model.prompt;

import java.util.Objects;
import java.util.UUID;

/** Real project context a prompt preview is compiled against. */
public sealed interface PromptPreviewTarget {
  UUID projectId();

  String type();

  /** Identity-reference prompt of a project character. */
  record Character(UUID projectId, UUID characterId) implements PromptPreviewTarget {
    public Character {
      Objects.requireNonNull(projectId, "projectId");
      Objects.requireNonNull(characterId, "characterId");
    }

    @Override
    public String type() {
      return "CHARACTER";
    }
  }

  /** Storyboard visual-beat image prompt. */
  record VisualBeat(UUID projectId, UUID chapterId, UUID visualBeatId)
      implements PromptPreviewTarget {
    public VisualBeat {
      Objects.requireNonNull(projectId, "projectId");
      Objects.requireNonNull(chapterId, "chapterId");
      Objects.requireNonNull(visualBeatId, "visualBeatId");
    }

    @Override
    public String type() {
      return "VISUAL_BEAT";
    }
  }

  /** Shot video prompt as it would be frozen for a new generation. */
  record Shot(UUID projectId, UUID shotId) implements PromptPreviewTarget {
    public Shot {
      Objects.requireNonNull(projectId, "projectId");
      Objects.requireNonNull(shotId, "shotId");
    }

    @Override
    public String type() {
      return "SHOT";
    }
  }
}
