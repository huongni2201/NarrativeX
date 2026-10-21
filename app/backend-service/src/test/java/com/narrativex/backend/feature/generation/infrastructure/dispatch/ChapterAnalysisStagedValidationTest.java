package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.generation.application.model.analysis.CanonHashCalculator;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisStage;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.infrastructure.analysis.ChapterAnalysisContractResources;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

class ChapterAnalysisStagedValidationTest {
  private static final String SOURCE = "Lan đến ga. Minh vẫy tay.";
  private final JsonMapper json = JsonMapper.builder().build();
  private final ChapterAnalysisContractResources resources =
      new ChapterAnalysisContractResources(json);
  private final ChapterAnalysisArtifactMaterializer materializer =
      new ChapterAnalysisArtifactMaterializer(null, null);
  private final GenerationJob job = createJob();

  @Test
  void canonRejectsDuplicateIdsAndConflictingDefinitions() {
    var context = json.createObjectNode();
    context.putArray("characters");
    context.putArray("locations");
    var duplicate = canonOutput(character("lan", "A traveler"), character("LAN", "A traveler"));

    var duplicateErrors =
        materializer.validateCanonStage(
            duplicate.toString().getBytes(), schema(ChapterAnalysisStage.CANON), context);
    assertThat(duplicateErrors).anySatisfy(error -> assertThat(error.path()).contains("ai_name"));

    var previous = json.createObjectNode();
    previous.putArray("characters").add(character("lan", "A traveler"));
    previous.putArray("locations");
    var changed = canonOutput(character("lan", "An older traveler"));

    var conflictErrors =
        materializer.validateCanonStage(
            changed.toString().getBytes(), schema(ChapterAnalysisStage.CANON), previous);
    assertThat(conflictErrors)
        .anySatisfy(
            error -> assertThat(error.path()).isEqualTo("canon.characters[0].visual_prompt"));
    assertThat(previous.at("/characters/0/visual_prompt").asText()).isEqualTo("A traveler");
  }

  @Test
  void storyRejectsUnknownCharacterAndLocationReferencesAgainstMergedCanon() {
    JsonNode story =
        read(
            """
            {"scenes":[{"title":"The station","location_ai_name":"unknown-place","character_ai_names":["unknown-person"],"visual_beats":[{"title":"A wave","visual_intent":"A wave","start_unit":0,"character_ai_names":["unknown-person"],"visual_direction":{"shot_size":"medium","camera_angle":"eye level","lens_mm":35,"focus_target":"Minh","action_phase":"wave","subject_placement":"center","background":"station","motivated_light":"sunset","palette":"warm","camera_movement":"static","movement_intensity":"low","crop_safe_area":"center"},"audio_cues":[{"cue_type":"DIALOGUE","speaker_ai_name":"unknown-person","start_unit":0,"end_unit":1,"adaptation_action":"KEEP_EXACT"}]}]}]}
            """);
    var canon = json.createObjectNode();
    canon.putArray("characters").add(character("lan", "A traveler"));
    canon.putArray("locations").add(location("station"));

    var findings =
        materializer.validateStoryStage(
            job, story.toString().getBytes(), -1, -1, schema(ChapterAnalysisStage.STORY), canon);

    assertThat(findings)
        .anySatisfy(error -> assertThat(error.message()).contains("location"))
        .anySatisfy(error -> assertThat(error.message()).contains("character"));
  }

  private JsonNode schema(ChapterAnalysisStage stage) {
    return resources.stageContracts(null).get(stage).responseSchema();
  }

  private JsonNode read(String value) {
    return json.readTree(value);
  }

  private ObjectNode canonOutput(JsonNode... characters) {
    var canon = json.createObjectNode();
    var characterArray = canon.putArray("characters");
    for (JsonNode character : characters) characterArray.add(character);
    canon.putArray("locations");
    return json.createObjectNode().set("canon", canon);
  }

  private ObjectNode character(String id, String prompt) {
    var character = json.createObjectNode();
    character.put("ai_name", id);
    character.put("canonical_name", "Lan");
    character.putArray("aliases");
    character.put("role", "PROTAGONIST");
    character.put("importance", "PRIMARY");
    character.put("description", "A traveler");
    character.put("visual_prompt", prompt);
    return character;
  }

  private ObjectNode location(String id) {
    var location = json.createObjectNode();
    location.put("ai_name", id);
    location.put("name", "Station");
    location.putArray("aliases");
    location.put("description", "A platform");
    location.put("visual_prompt", "A quiet station");
    return location;
  }

  private static GenerationJob createJob() {
    return GenerationJob.createChapterAnalysis(
        UUID.randomUUID(),
        UUID.randomUUID(),
        UUID.randomUUID(),
        UUID.randomUUID(),
        0,
        CanonHashCalculator.sha256(SOURCE),
        SOURCE,
        "vi",
        "stage-validation-test");
  }
}
