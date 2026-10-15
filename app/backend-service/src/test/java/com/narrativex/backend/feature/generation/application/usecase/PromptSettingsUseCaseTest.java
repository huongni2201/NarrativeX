package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettings;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettingsDefaults;
import com.narrativex.backend.feature.generation.application.port.out.PromptSettingsRepository;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class PromptSettingsUseCaseTest {
  private final InMemoryRepository repository = new InMemoryRepository();
  private final PromptSettingsUseCase useCase = new PromptSettingsUseCase(repository);

  @Test
  void firstReadSeedsTheBuiltInDefaultsAtRevisionOne() {
    PromptSettings current = useCase.current();

    assertThat(current.revision()).isEqualTo(1);
    assertThat(current.semanticHash()).isEqualTo(PromptSettingsDefaults.settings().semanticHash());
    assertThat(repository.inserts.get()).isEqualTo(1);
  }

  @Test
  void seedingNeverOverwritesExistingContent() {
    PromptSettings first = useCase.current();
    PromptSettings edited = first.withActiveStyle("CINEMATIC");
    useCase.save(edited);

    // A second "initialization" (restart, or a racing instance) must keep the saved content.
    PromptSettings afterRestart = new PromptSettingsUseCase(repository).current();

    assertThat(afterRestart.activeStyleId()).isEqualTo("CINEMATIC");
    assertThat(afterRestart.revision()).isEqualTo(2);
    assertThat(repository.inserts.get()).isEqualTo(1);
  }

  @Test
  void saveIncrementsTheRevisionAndStoresContent() {
    PromptSettings current = useCase.current();

    PromptSettings saved = useCase.save(current.withActiveStyle("STORYBOOK_WATERCOLOR"));

    assertThat(saved.revision()).isEqualTo(current.revision() + 1);
    assertThat(useCase.current().activeStyleId()).isEqualTo("STORYBOOK_WATERCOLOR");
  }

  @Test
  void staleSaveIsAConflictAndDoesNotOverwrite() {
    PromptSettings loadedByBothForms = useCase.current();
    useCase.save(loadedByBothForms.withActiveStyle("CINEMATIC"));

    assertThatThrownBy(() -> useCase.save(loadedByBothForms.withActiveStyle("STORYBOOK_WATERCOLOR")))
        .isInstanceOf(ResourceConflictException.class)
        .hasMessageContaining(PromptSettingsUseCase.REVISION_CONFLICT_CODE);

    assertThat(useCase.current().activeStyleId()).isEqualTo("CINEMATIC");
    assertThat(useCase.current().revision()).isEqualTo(2);
  }

  @Test
  void compareAndSetLossAfterTheReadIsStillAConflict() {
    PromptSettings current = useCase.current();
    repository.failNextUpdate = true;

    assertThatThrownBy(() -> useCase.save(current.withActiveStyle("CINEMATIC")))
        .isInstanceOf(ResourceConflictException.class);
  }

  @Test
  void savingIdenticalContentKeepsTheRevision() {
    PromptSettings current = useCase.current();

    PromptSettings result = useCase.save(current);

    assertThat(result.revision()).isEqualTo(current.revision());
    assertThat(repository.updates.get()).isZero();
  }

  @Test
  void saveRequiresTheRevisionBeingEdited() {
    useCase.current();
    PromptSettings draft = PromptSettingsDefaults.settings(); // revision 0 = never loaded

    assertThatThrownBy(() -> useCase.save(draft))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("revision");
  }

  @Test
  void defaultsAreAlwaysTheBuiltInsRegardlessOfSavedContent() {
    useCase.save(useCase.current().withActiveStyle("CINEMATIC"));

    assertThat(useCase.defaults().activeStyleId()).isEqualTo("CINEMATIC_ANIME");
    assertThat(useCase.defaults().revision()).isZero();
  }

  private static final class InMemoryRepository implements PromptSettingsRepository {
    private PromptSettings stored;
    final AtomicInteger inserts = new AtomicInteger();
    final AtomicInteger updates = new AtomicInteger();
    boolean failNextUpdate;

    @Override
    public synchronized Optional<PromptSettings> find() {
      return Optional.ofNullable(stored);
    }

    @Override
    public synchronized PromptSettings insertIfAbsent(PromptSettings initial) {
      if (stored == null) {
        stored = initial.withRevision(1);
        inserts.incrementAndGet();
      }
      return stored;
    }

    @Override
    public synchronized Optional<PromptSettings> update(
        PromptSettings desired, long expectedRevision) {
      if (failNextUpdate) {
        failNextUpdate = false;
        return Optional.empty();
      }
      if (stored == null || stored.revision() != expectedRevision) return Optional.empty();
      stored = desired.withRevision(expectedRevision + 1);
      updates.incrementAndGet();
      return Optional.of(stored);
    }
  }
}
