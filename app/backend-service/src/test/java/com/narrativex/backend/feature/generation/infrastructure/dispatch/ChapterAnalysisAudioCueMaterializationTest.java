package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.storyboard.application.service.SourceAnchorResolver;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter.ChapterCanonReconciliationService;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.AudioCueRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.HookPlanMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.HookPlanRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.StoryBeatRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.StoryboardMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.VisualBeatRow;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ChapterAnalysisAudioCueMaterializationTest {
  private static final String SOURCE = "😀 He said: Hello. She smiled.";
  private static final String DIRECTION =
      """
      {"shot_size":"WIDE","camera_angle":"EYE_LEVEL","lens_mm":35,"focus_target":"child","action_phase":"BEFORE",
       "subject_placement":"center","background":"room","motivated_light":"soft","palette":"warm",
       "camera_movement":"NONE","movement_intensity":"SUBTLE","crop_safe_area":"full"}
      """;
  private static final String DIALOGUE_CUE =
      """
      {"cue_type":"DIALOGUE","speaker_ai_name":"child","start_unit":0,"end_unit":0,
       "adaptation_action":"LIGHT_EDIT","adapted_text":"Hello.","delivery_hint":"warm"}
      """;
  private static final String NARRATOR_CUE =
      """
      {"cue_type":"NARRATOR","start_unit":1,"end_unit":1,"adaptation_action":"KEEP_EXACT",
       "adapted_text":"the model copy is ignored"}
      """;

  private static String beat(int startUnit, String... cues) {
    return """
        {"title":"Beat","visual_intent":"The child greets","character_ai_names":["child"],
         "start_unit":%d,"visual_direction":%s,"audio_cues":[%s]}
        """
        .formatted(startUnit, DIRECTION, String.join(",", cues));
  }

  private static String payload(String... beats) {
    return """
        {"canon":{"characters":[{"ai_name":"child","canonical_name":"Child","aliases":[],
          "role":"PROTAGONIST","importance":"PRIMARY","description":"A child","visual_prompt":"A child"}],"locations":[]},
         "hook_plan":{"promise":"A greeting"},"scenes":[{"title":"Scene","character_ai_names":["child"],
         "visual_beats":[%s]}]}
        """
        .formatted(String.join(",", beats));
  }

  private static final String PAYLOAD = payload(beat(0, DIALOGUE_CUE, NARRATOR_CUE));

  private final List<AudioCueRow> cues = new ArrayList<>();
  private final List<HookPlanRow> hooks = new ArrayList<>();
  private final List<StoryBeatRow> storyBeats = new ArrayList<>();
  private final List<VisualBeatRow> visualBeats = new ArrayList<>();
  private final UUID storyBeatId = UUID.randomUUID();
  private final UUID participantId = UUID.randomUUID();
  private GenerationJob job;
  private ChapterRow chapter;
  private ChapterAnalysisArtifactMaterializer materializer;

  @BeforeEach
  void setUp() throws Exception {
    String hash =
        HexFormat.of()
            .formatHex(
                MessageDigest.getInstance("SHA-256")
                    .digest(SOURCE.getBytes(StandardCharsets.UTF_8)));
    job =
        GenerationJob.createChapterAnalysis(
            UUID.randomUUID(),
            UUID.randomUUID(),
            UUID.randomUUID(),
            UUID.randomUUID(),
            0L,
            hash,
            SOURCE,
            "en",
            "cue-analysis-test");
    StoryboardMapper storyboard = mock(StoryboardMapper.class);
    when(storyboard.insertScene(any())).thenReturn(UUID.randomUUID());
    when(storyboard.insertStoryBeat(any()))
        .thenAnswer(
            i -> {
              storyBeats.add(i.getArgument(0));
              return storyBeatId;
            });
    when(storyboard.insertVisualBeat(any()))
        .thenAnswer(
            i -> {
              visualBeats.add(i.getArgument(0));
              return UUID.randomUUID();
            });
    when(storyboard.insertAudioCue(any()))
        .thenAnswer(
            i -> {
              AudioCueRow cue = i.getArgument(0);
              cues.add(cue);
              return UUID.randomUUID();
            });
    HookPlanMapper hookMapper = mock(HookPlanMapper.class);
    when(hookMapper.insert(any()))
        .thenAnswer(
            i -> {
              hooks.add(i.getArgument(0));
              return UUID.randomUUID();
            });
    ChapterMapper chapters = mock(ChapterMapper.class);
    chapter = new ChapterRow();
    chapter.setSourceHash(hash);
    chapter.setSourceText(SOURCE);
    chapter.setRowVersion(0L);
    when(chapters.findById(job.getChapterId())).thenReturn(chapter);
    when(chapters.update(any())).thenReturn(1);
    ChapterCanonReconciliationService canon = mock(ChapterCanonReconciliationService.class);
    when(canon.reconcileAndPersist(any(), any()))
        .thenReturn(
            new ChapterCanonReconciliationService.ReconciledCanon(
                Map.of("child", participantId), Map.of()));
    materializer =
        new ChapterAnalysisArtifactMaterializer(
            storyboard,
            chapters,
            new SourceAnchorResolver(),
            null,
            canon,
            hookMapper,
            null,
            null,
            null,
            null);
  }

  @Test
  void longVisualIntentKeepsItsTextAndUsesTheDramaticIntentAsStoryPurpose() {
    String intent =
        "The child reveals the truth and changes how the other characters understand the entire encounter.";
    String json =
        PAYLOAD
            .replace("The child greets", intent)
            .replace("\"title\":\"Beat\"", "\"title\":\"Beat\",\"dramatic_intent\":\"REVEAL\"");
    materializer.materialize(job, json.getBytes(StandardCharsets.UTF_8));
    assertThat(storyBeats).singleElement().extracting(StoryBeatRow::getPurpose).isEqualTo("REVEAL");
    assertThat(visualBeats)
        .singleElement()
        .extracting(VisualBeatRow::getVisualIntent)
        .isEqualTo(intent);
  }

  @Test
  void attachesCuesToTheirBeatWithGlobalUtf16OffsetsAndAuthoritativeKeepExactText() {
    materializer.materialize(job, PAYLOAD.getBytes(StandardCharsets.UTF_8));
    assertThat(cues).hasSize(2);
    AudioCueRow dialogue = cues.get(0);
    assertThat(dialogue.getStoryBeatId()).isEqualTo(storyBeatId);
    assertThat(dialogue.getSpeakerProjectCharacterId()).isEqualTo(participantId);
    assertThat(dialogue.getSourceStart()).isEqualTo(0);
    assertThat(dialogue.getSourceEnd()).isEqualTo(18);
    assertThat(dialogue.getAdaptedText()).isEqualTo("Hello.");
    assertThat(dialogue.getCueType()).isEqualTo("DIALOGUE");
    assertThat(dialogue.getStatus()).isEqualTo("DRAFT");
    assertThat(dialogue.getAudioStartMs()).isNull();
    AudioCueRow narrator = cues.get(1);
    assertThat(narrator.getSourceStart()).isEqualTo(19);
    assertThat(narrator.getSourceEnd()).isEqualTo(30);
    assertThat(narrator.getAdaptedText()).isEqualTo("She smiled.");
  }

  @Test
  void keepExactDoesNotNeedTheModelToCopyTheText() {
    String payload =
        PAYLOAD.replace(
            "\"adapted_text\":\"the model copy is ignored\"", "\"delivery_hint\":\"soft\"");
    materializer.materialize(job, payload.getBytes(StandardCharsets.UTF_8));
    assertThat(cues.get(1).getAdaptedText()).isEqualTo("She smiled.");
  }

  @Test
  void rejectsAnUnknownSpeakerBeforeRetentionWrites() {
    String payload =
        PAYLOAD.replace("\"speaker_ai_name\":\"child\"", "\"speaker_ai_name\":\"outsider\"");
    assertThatThrownBy(
            () -> materializer.materialize(job, payload.getBytes(StandardCharsets.UTF_8)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("speaker");
    assertThat(hooks).isEmpty();
    assertThat(cues).isEmpty();
  }

  @Test
  void rejectsAChangedSourceBeforeAnyRetentionWrites() {
    chapter.setSourceHash("f".repeat(64));
    assertThatThrownBy(
            () -> materializer.materialize(job, PAYLOAD.getBytes(StandardCharsets.UTF_8)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("source changed");
    assertThat(hooks).isEmpty();
    assertThat(cues).isEmpty();
  }

  @Test
  void rejectsUnknownCueFieldsBeforeRetentionWrites() {
    String payload =
        PAYLOAD.replace(
            "\"cue_type\":\"DIALOGUE\"", "\"cue_type\":\"DIALOGUE\",\"providerOptions\":{}");
    assertThatThrownBy(
            () -> materializer.materialize(job, payload.getBytes(StandardCharsets.UTF_8)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("unknown fields");
    assertThat(hooks).isEmpty();
  }

  @Test
  void rejectsABeatStartOutsideTheChapterBeforeRetentionWrites() {
    String payload = payload(beat(0, DIALOGUE_CUE), beat(9));
    assertThatThrownBy(
            () -> materializer.materialize(job, payload.getBytes(StandardCharsets.UTF_8)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("outside the chapter");
    assertThat(hooks).isEmpty();
  }

  @Test
  void rejectsBeatsThatDoNotAdvance() {
    String payload = payload(beat(0), beat(0));
    assertThatThrownBy(
            () -> materializer.materialize(job, payload.getBytes(StandardCharsets.UTF_8)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("greater than the previous");
  }

  @Test
  void rejectsANonIntegerUnitIndex() {
    String payload =
        PAYLOAD.replace(
            "\"start_unit\":0,\"visual_direction\"", "\"start_unit\":\"0\",\"visual_direction\"");
    assertThatThrownBy(
            () -> materializer.materialize(job, payload.getBytes(StandardCharsets.UTF_8)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("start_unit must be a non-negative integer");
  }

  @Test
  void rejectsACueOutsideItsBeat() {
    String payload = payload(beat(0, DIALOGUE_CUE), beat(1, DIALOGUE_CUE));
    assertThatThrownBy(
            () -> materializer.materialize(job, payload.getBytes(StandardCharsets.UTF_8)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("outside its visual beat");
  }

  @Test
  void rejectsCuesThatRepeatExactText() {
    String keepExact = DIALOGUE_CUE.replace("LIGHT_EDIT", "KEEP_EXACT");
    String payload = payload(beat(0, keepExact, DIALOGUE_CUE));
    assertThatThrownBy(
            () -> materializer.materialize(job, payload.getBytes(StandardCharsets.UTF_8)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("repeats units");
  }

  @Test
  void allowsEditedCuesToSplitOneUnit() {
    String narrationTag =
        """
        {"cue_type":"NARRATOR","start_unit":0,"end_unit":0,"adaptation_action":"LIGHT_EDIT",
         "adapted_text":"He said:"}
        """;
    materializer.materialize(
        job, payload(beat(0, narrationTag, DIALOGUE_CUE)).getBytes(StandardCharsets.UTF_8));
    // The two cues share unit 0; unit 1 is narrated by the gap-filling cue.
    assertThat(cues).hasSize(3);
    assertThat(cues.get(0).getSourceStart()).isEqualTo(cues.get(1).getSourceStart());
  }

  @Test
  void narratesUnitsNoCueCoveredInsteadOfDroppingThem() {
    materializer.materialize(job, payload(beat(0, DIALOGUE_CUE)).getBytes(StandardCharsets.UTF_8));

    assertThat(cues).hasSize(2);
    AudioCueRow filled = cues.get(1);
    assertThat(filled.getCueType()).isEqualTo("NARRATOR");
    assertThat(filled.getAdaptationAction()).isEqualTo("KEEP_EXACT");
    assertThat(filled.getAdaptedText()).isEqualTo("She smiled.");
    assertThat(filled.getOrderIndex()).isEqualTo(1);
  }

  @Test
  void aBeatWithoutCuesStillNarratesItsWholeSourceRange() {
    materializer.materialize(job, payload(beat(0)).getBytes(StandardCharsets.UTF_8));

    assertThat(cues).hasSize(1);
    assertThat(cues.get(0).getSourceStart()).isEqualTo(0);
    assertThat(cues.get(0).getSourceEnd()).isEqualTo(30);
    assertThat(cues.get(0).getAdaptedText()).isEqualTo(SOURCE);
  }

  @Test
  void validateAcceptsACompleteResultWithoutFindings() {
    assertThat(materializer.validate(job, PAYLOAD.getBytes(StandardCharsets.UTF_8), -1, -1))
        .isEmpty();
  }

  @Test
  void validateReportsEveryStructuralErrorOfAResultWithoutWriting() {
    String missingTitle = beat(0, DIALOGUE_CUE).replace("\"title\":\"Beat\",", "");
    var findings =
        materializer.validate(
            job, payload(missingTitle, beat(9)).getBytes(StandardCharsets.UTF_8), -1, -1);

    assertThat(findings)
        .extracting(ChapterAnalysisArtifactMaterializer.Violation::severity)
        .containsOnly(ChapterAnalysisArtifactMaterializer.Severity.ERROR);
    assertThat(findings)
        .extracting(ChapterAnalysisArtifactMaterializer.Violation::path)
        .anyMatch(path -> path.contains("visual_beats[0]"));
    assertThat(cues).isEmpty();
    assertThat(hooks).isEmpty();
  }

  @Test
  void validateReportsOrderingAndCueErrorsInSeparatePhases() {
    var ordering =
        materializer.validate(
            job, payload(beat(0), beat(0)).getBytes(StandardCharsets.UTF_8), -1, -1);
    assertThat(ordering)
        .extracting(ChapterAnalysisArtifactMaterializer.Violation::message)
        .anyMatch(message -> message.contains("greater than the previous"));

    String keepExact = DIALOGUE_CUE.replace("LIGHT_EDIT", "KEEP_EXACT");
    var cueError =
        materializer.validate(
            job, payload(beat(0, keepExact, keepExact)).getBytes(StandardCharsets.UTF_8), -1, -1);
    assertThat(cueError)
        .anyMatch(
            f ->
                f.severity() == ChapterAnalysisArtifactMaterializer.Severity.ERROR
                    && f.path().endsWith("audio_cues"));
  }

  @Test
  void validateWarnsAboutUnnarratedUnitsAndLongBeats() {
    var findings =
        materializer.validate(
            job, payload(beat(0, DIALOGUE_CUE)).getBytes(StandardCharsets.UTF_8), -1, -1);

    assertThat(findings)
        .extracting(ChapterAnalysisArtifactMaterializer.Violation::severity)
        .containsOnly(ChapterAnalysisArtifactMaterializer.Severity.WARNING);
    assertThat(findings)
        .extracting(ChapterAnalysisArtifactMaterializer.Violation::message)
        .anyMatch(message -> message.contains("units 1..1 are not narrated"));
  }

  @Test
  void validateChecksAPartialResultAgainstItsUnitWindow() {
    var outside = materializer.validate(job, PAYLOAD.getBytes(StandardCharsets.UTF_8), 1, 1);
    assertThat(outside)
        .extracting(ChapterAnalysisArtifactMaterializer.Violation::message)
        .anyMatch(message -> message.contains("outside the allowed units 1..1"));

    var windowed = payload(beat(1, NARRATOR_CUE.replace("\"start_unit\":1", "\"start_unit\":1")));
    assertThat(materializer.validate(job, windowed.getBytes(StandardCharsets.UTF_8), 1, 1))
        .isEmpty();
  }
}
