package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.generation.application.model.prompt.PromptPreviewResult;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptPreviewTarget;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettings;
import com.narrativex.backend.feature.generation.application.port.in.PromptSettingsAccess;
import com.narrativex.backend.feature.generation.application.port.out.PromptPreviewSource;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Read-only preview of the prompts a new operation would freeze. */
@Service
@RequiredArgsConstructor
public class PromptPreviewUseCase {
  private final PromptSettingsAccess settingsAccess;
  private final PromptPreviewSource source;

  public record Preview(
      boolean draft,
      long savedRevision,
      PromptSettings settings,
      PromptPreviewTarget target,
      PromptPreviewResult result) {}

  /** {@code draft == null} previews the saved configuration. */
  // Not read-only: resolving the saved configuration may seed the defaults on first use.
  @Transactional
  public Preview preview(PromptSettings draft, PromptPreviewTarget target) {
    PromptSettings saved = settingsAccess.current();
    PromptSettings used = draft == null ? saved : draft;
    return new Preview(draft != null, saved.revision(), used, target, source.preview(used, target));
  }
}
