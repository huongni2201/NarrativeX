package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.application.model.prompt.PromptPreviewResult;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptPreviewTarget;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettings;

/**
 * Compiles prompts for a real project target with the given settings through the same composers
 * used at admission. Never calls a provider, creates a job, or writes anything.
 */
public interface PromptPreviewSource {
  PromptPreviewResult preview(PromptSettings settings, PromptPreviewTarget target);
}
