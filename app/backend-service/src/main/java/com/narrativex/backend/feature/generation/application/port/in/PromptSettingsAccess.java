package com.narrativex.backend.feature.generation.application.port.in;

import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettings;

/** Read access to the current installation-wide prompt configuration for other features. */
public interface PromptSettingsAccess {
  /** Returns the current configuration; callers resolve it once per operation or batch. */
  PromptSettings current();
}
