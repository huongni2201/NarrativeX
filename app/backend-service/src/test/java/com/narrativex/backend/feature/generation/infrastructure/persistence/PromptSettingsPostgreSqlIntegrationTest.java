package com.narrativex.backend.feature.generation.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettings;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettingsDefaults;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptStyleProfile;
import com.narrativex.backend.feature.generation.application.port.out.PromptSettingsRepository;
import com.narrativex.backend.feature.generation.application.usecase.PromptSettingsUseCase;
import com.narrativex.backend.support.PostgreSqlIntegrationTestSupport;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class PromptSettingsPostgreSqlIntegrationTest extends PostgreSqlIntegrationTestSupport {
  @Autowired PromptSettingsRepository repository;
  @Autowired PromptSettingsUseCase useCase;
  @Autowired JdbcTemplate jdbc;

  @BeforeEach
  void reset() {
    jdbc.update("DELETE FROM prompt_settings");
  }

  @Test
  void firstReadSeedsDefaultsAndSurvivesRepeatedInitialization() {
    PromptSettings seeded = useCase.current();
    PromptSettings edited = useCase.save(seeded.withActiveStyle("CINEMATIC"));

    PromptSettings again = repository.insertIfAbsent(PromptSettingsDefaults.settings());

    assertThat(seeded.revision()).isEqualTo(1);
    assertThat(edited.revision()).isEqualTo(2);
    assertThat(again.activeStyleId()).isEqualTo("CINEMATIC");
    assertThat(again.revision()).isEqualTo(2);
    assertThat(jdbc.queryForObject("SELECT count(*) FROM prompt_settings", Integer.class))
        .isEqualTo(1);
  }

  @Test
  void concurrentFirstInitializationCreatesExactlyOneRow() throws Exception {
    List<Callable<PromptSettings>> tasks = new ArrayList<>();
    for (int i = 0; i < 8; i++) {
      tasks.add(() -> repository.insertIfAbsent(PromptSettingsDefaults.settings()));
    }
    var executor = Executors.newFixedThreadPool(8);
    try {
      for (var future : executor.invokeAll(tasks)) {
        assertThat(future.get().revision()).isEqualTo(1);
      }
    } finally {
      executor.shutdownNow();
    }
    assertThat(jdbc.queryForObject("SELECT count(*) FROM prompt_settings", Integer.class))
        .isEqualTo(1);
  }

  @Test
  void staleSaveConflictsAndLeavesStoredContentUntouched() {
    PromptSettings loaded = useCase.current();
    useCase.save(loaded.withActiveStyle("CINEMATIC"));

    assertThatThrownBy(() -> useCase.save(loaded.withActiveStyle("STORYBOOK_WATERCOLOR")))
        .isInstanceOf(ResourceConflictException.class);

    assertThat(useCase.current().activeStyleId()).isEqualTo("CINEMATIC");
    assertThat(useCase.current().revision()).isEqualTo(2);
  }

  @Test
  void customStyleAndUnicodeRoundTripThroughJsonb() {
    PromptSettings loaded = useCase.current();
    List<PromptStyleProfile> styles = new ArrayList<>(loaded.styles());
    styles.add(
        new PromptStyleProfile(
            "NOIR_1", "Phim đen trắng ế", "đen trắng, tương phản cao", "màu sắc rực rỡ", ""));
    PromptSettings desired =
        new PromptSettings(
            loaded.formatVersion(),
            loaded.revision(),
            "NOIR_1",
            styles,
            loaded.instructions(),
            loaded.videoNegativePrompt());

    PromptSettings saved = useCase.save(desired);
    PromptSettings reloaded = repository.find().orElseThrow();

    assertThat(saved.revision()).isEqualTo(2);
    assertThat(reloaded.activeStyle().name()).isEqualTo("Phim đen trắng ế");
    assertThat(reloaded.semanticHash()).isEqualTo(desired.semanticHash());
    assertThat(
            jdbc.queryForObject(
                "SELECT semantic_hash FROM prompt_settings WHERE singleton_id", String.class))
        .isEqualTo(desired.semanticHash());
  }

  @Test
  void databaseRejectsAnySecondRowOrInvalidRevision() {
    useCase.current();

    assertThatThrownBy(
            () ->
                jdbc.update(
                    "INSERT INTO prompt_settings (singleton_id, revision, format_version, settings,"
                        + " semantic_hash) VALUES (FALSE, 1, 1, '{}'::jsonb, repeat('a', 64))"))
        .isInstanceOf(org.springframework.dao.DataAccessException.class);
    assertThatThrownBy(() -> jdbc.update("UPDATE prompt_settings SET revision = 0"))
        .isInstanceOf(org.springframework.dao.DataAccessException.class);
  }
}
