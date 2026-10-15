package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettings;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettingsDefaults;
import com.narrativex.backend.feature.generation.application.port.in.PromptSettingsAccess;
import com.narrativex.backend.feature.generation.application.port.out.PromptSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Owns the single installation-wide prompt configuration. Reads self-initialize from the versioned
 * defaults without ever overwriting stored content; saves are compare-and-set on the revision the
 * editor started from.
 */
@Service
@RequiredArgsConstructor
public class PromptSettingsUseCase implements PromptSettingsAccess {
  public static final String REVISION_CONFLICT_CODE = "PROMPT_SETTINGS_REVISION_CONFLICT";

  private final PromptSettingsRepository repository;

  @Override
  @Transactional
  public PromptSettings current() {
    return repository
        .find()
        .orElseGet(() -> repository.insertIfAbsent(PromptSettingsDefaults.settings()));
  }

  /** The built-in defaults that the editor can restore into its draft. */
  public PromptSettings defaults() {
    return PromptSettingsDefaults.settings();
  }

  /**
   * Saves {@code desired}, whose revision is the revision the editor loaded. A stale revision is a
   * conflict; saving content identical to the stored configuration is a no-op that keeps the
   * revision, so unchanged saves never invalidate in-flight previews.
   */
  @Transactional
  public PromptSettings save(PromptSettings desired) {
    long expectedRevision = desired.revision();
    if (expectedRevision <= 0) {
      throw new DomainValidationException(
          "revision: the revision being edited is required to save");
    }
    PromptSettings current = current();
    if (current.revision() != expectedRevision) {
      throw conflict(current.revision());
    }
    if (current.semanticHash().equals(desired.semanticHash())) {
      return current;
    }
    return repository
        .update(desired, expectedRevision)
        .orElseThrow(() -> conflict(current().revision()));
  }

  private static ResourceConflictException conflict(long currentRevision) {
    return new ResourceConflictException(
        REVISION_CONFLICT_CODE
            + ": prompt settings changed (current revision "
            + currentRevision
            + "); reload before saving");
  }
}
