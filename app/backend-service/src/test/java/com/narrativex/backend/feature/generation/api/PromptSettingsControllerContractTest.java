package com.narrativex.backend.feature.generation.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.generation.api.controller.PromptSettingsController;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptPreviewResult;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptPreviewTarget;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettings;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettingsJson;
import com.narrativex.backend.feature.generation.application.port.out.PromptPreviewSource;
import com.narrativex.backend.feature.generation.application.port.out.PromptSettingsRepository;
import com.narrativex.backend.feature.generation.application.usecase.PromptPreviewUseCase;
import com.narrativex.backend.feature.generation.application.usecase.PromptSettingsUseCase;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

class PromptSettingsControllerContractTest {
  private final JsonMapper mapper = JsonMapper.builder().build();
  private final InMemoryRepository repository = new InMemoryRepository();
  private final PromptSettingsUseCase settingsUseCase = new PromptSettingsUseCase(repository);
  private final List<PromptPreviewTarget> previewedTargets = new ArrayList<>();
  private final PromptPreviewSource previewSource =
      (settings, target) -> {
        previewedTargets.add(target);
        return new PromptPreviewResult(
            "P:" + settings.activeStyle().positivePrompt(),
            "N:" + settings.activeStyle().negativePrompt(),
            "F:" + settings.activeStyleId());
      };
  private final PromptSettingsController controller =
      new PromptSettingsController(
          settingsUseCase, new PromptPreviewUseCase(settingsUseCase, previewSource), mapper);

  private ObjectNode loaded() {
    return (ObjectNode) controller.get().data().get("settings");
  }

  private ObjectNode characterTarget() {
    ObjectNode target = mapper.createObjectNode();
    target.put("type", "CHARACTER");
    target.put("projectId", UUID.randomUUID().toString());
    target.put("characterId", UUID.randomUUID().toString());
    return target;
  }

  @Test
  void getReturnsSavedSettingsDefaultsAndEffectiveHashWithDecimalStringRevision() {
    ObjectNode data = controller.get().data();

    assertThat(data.get("settings").get("revision").asText()).isEqualTo("1");
    assertThat(data.get("settings").get("activeStyleId").asText()).isEqualTo("CINEMATIC_ANIME");
    assertThat(data.get("defaults").get("revision").asText()).isEqualTo("0");
    assertThat(data.get("effectiveHash").asText()).matches("[0-9a-f]{64}");
  }

  @Test
  void putSavesAndReturnsTheNextRevision() {
    ObjectNode edited = loaded();
    edited.put("activeStyleId", "STORYBOOK_WATERCOLOR");

    ObjectNode saved = (ObjectNode) controller.put(edited).data().get("settings");

    assertThat(saved.get("revision").asText()).isEqualTo("2");
    assertThat(saved.get("activeStyleId").asText()).isEqualTo("STORYBOOK_WATERCOLOR");
    assertThat(loaded().get("activeStyleId").asText()).isEqualTo("STORYBOOK_WATERCOLOR");
  }

  @Test
  void stalePutIsAConflictThatDoesNotOverwriteTheNewerForm() {
    ObjectNode formA = loaded();
    ObjectNode formB = loaded();
    formA.put("activeStyleId", "CINEMATIC");
    formB.put("activeStyleId", "STORYBOOK_WATERCOLOR");
    controller.put(formA);

    assertThatThrownBy(() -> controller.put(formB))
        .isInstanceOf(ResourceConflictException.class)
        .hasMessageContaining("PROMPT_SETTINGS_REVISION_CONFLICT");
    assertThat(loaded().get("activeStyleId").asText()).isEqualTo("CINEMATIC");
  }

  @Test
  void putRejectsUnknownFieldsAndMissingRevision() {
    ObjectNode unknown = loaded();
    unknown.put("owner", "someone");
    assertThatThrownBy(() -> controller.put(unknown))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("owner");

    ObjectNode noRevision = loaded();
    noRevision.remove("revision");
    assertThatThrownBy(() -> controller.put(noRevision))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("revision");
  }

  @Test
  void previewOfADraftNeverPersistsAndReportsTheDraftSource() {
    ObjectNode draft = loaded();
    draft.put("activeStyleId", "CINEMATIC");
    ObjectNode body = mapper.createObjectNode();
    body.set("settings", draft);
    body.set("target", characterTarget());

    ObjectNode result = controller.preview(body).data();

    assertThat(result.get("source").asText()).isEqualTo("DRAFT");
    assertThat(result.get("styleId").asText()).isEqualTo("CINEMATIC");
    assertThat(result.get("savedRevision").asText()).isEqualTo("1");
    assertThat(result.get("targetType").asText()).isEqualTo("CHARACTER");
    assertThat(result.get("finalText").asText()).isEqualTo("F:CINEMATIC");
    assertThat(result.get("effectiveHash").asText())
        .isEqualTo(PromptSettingsJson.parse(draft).effectiveHash());
    assertThat(loaded().get("activeStyleId").asText()).isEqualTo("CINEMATIC_ANIME");
    assertThat(repository.updates).isZero();
  }

  @Test
  void previewWithoutSettingsUsesTheSavedConfiguration() {
    ObjectNode body = mapper.createObjectNode();
    body.set("target", characterTarget());

    ObjectNode result = controller.preview(body).data();

    assertThat(result.get("source").asText()).isEqualTo("SAVED");
    assertThat(result.get("settingsRevision").asText()).isEqualTo("1");
    assertThat(result.get("styleId").asText()).isEqualTo("CINEMATIC_ANIME");
  }

  @Test
  void previewSupportsVisualBeatAndShotTargets() {
    UUID project = UUID.randomUUID();
    ObjectNode beat = mapper.createObjectNode();
    beat.put("type", "VISUAL_BEAT");
    beat.put("projectId", project.toString());
    beat.put("chapterId", UUID.randomUUID().toString());
    beat.put("visualBeatId", UUID.randomUUID().toString());
    ObjectNode shot = mapper.createObjectNode();
    shot.put("type", "SHOT");
    shot.put("projectId", project.toString());
    shot.put("shotId", UUID.randomUUID().toString());

    for (ObjectNode target : List.of(beat, shot)) {
      ObjectNode body = mapper.createObjectNode();
      body.set("target", target);
      controller.preview(body);
    }

    assertThat(previewedTargets)
        .hasSize(2)
        .satisfies(
            targets -> {
              assertThat(targets.get(0)).isInstanceOf(PromptPreviewTarget.VisualBeat.class);
              assertThat(targets.get(1)).isInstanceOf(PromptPreviewTarget.Shot.class);
            });
  }

  @Test
  void previewRejectsMalformedRequests() {
    ObjectNode unknownRoot = mapper.createObjectNode();
    unknownRoot.set("target", characterTarget());
    unknownRoot.put("extra", true);
    assertThatThrownBy(() -> controller.preview(unknownRoot))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("extra");

    ObjectNode noTarget = mapper.createObjectNode();
    assertThatThrownBy(() -> controller.preview(noTarget))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("target");

    ObjectNode badType = mapper.createObjectNode();
    ObjectNode target = characterTarget();
    target.put("type", "PROJECT");
    badType.set("target", target);
    assertThatThrownBy(() -> controller.preview(badType))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("target.type");

    ObjectNode badUuid = mapper.createObjectNode();
    ObjectNode brokenTarget = characterTarget();
    brokenTarget.put("projectId", "not-a-uuid");
    badUuid.set("target", brokenTarget);
    assertThatThrownBy(() -> controller.preview(badUuid))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("projectId");

    ObjectNode extraTargetField = mapper.createObjectNode();
    ObjectNode withExtra = characterTarget();
    withExtra.put("shotId", UUID.randomUUID().toString());
    extraTargetField.set("target", withExtra);
    assertThatThrownBy(() -> controller.preview(extraTargetField))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("shotId");

    ObjectNode invalidDraft = mapper.createObjectNode();
    JsonNode draft = loaded().put("activeStyleId", "MISSING");
    invalidDraft.set("settings", draft);
    invalidDraft.set("target", characterTarget());
    assertThatThrownBy(() -> controller.preview(invalidDraft))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("activeStyleId");
  }

  private static final class InMemoryRepository implements PromptSettingsRepository {
    private PromptSettings stored;
    int updates;

    @Override
    public synchronized Optional<PromptSettings> find() {
      return Optional.ofNullable(stored);
    }

    @Override
    public synchronized PromptSettings insertIfAbsent(PromptSettings initial) {
      if (stored == null) stored = initial.withRevision(1);
      return stored;
    }

    @Override
    public synchronized Optional<PromptSettings> update(
        PromptSettings desired, long expectedRevision) {
      if (stored == null || stored.revision() != expectedRevision) return Optional.empty();
      stored = desired.withRevision(expectedRevision + 1);
      updates++;
      return Optional.of(stored);
    }
  }
}
