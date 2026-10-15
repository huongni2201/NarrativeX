package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettings;
import java.util.Optional;

/** Persistence port for the single installation-wide prompt configuration. */
public interface PromptSettingsRepository {
  Optional<PromptSettings> find();

  /**
   * Inserts {@code initial} at revision 1 only when no configuration exists, then returns whatever
   * is stored. Safe under concurrent callers and never overwrites existing content.
   */
  PromptSettings insertIfAbsent(PromptSettings initial);

  /**
   * Replaces the configuration when the stored revision equals {@code expectedRevision}; the stored
   * revision is incremented by one. Empty means the revision no longer matches.
   */
  Optional<PromptSettings> update(PromptSettings desired, long expectedRevision);
}
