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
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.StoryboardMapper;
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
  private static final String SOURCE = "😀 He said: Hello.";
  private static final String PAYLOAD =
      """
      {"canon":{"characters":[{"ai_name":"child","canonical_name":"Child","aliases":[],
        "role":"PROTAGONIST","importance":"PRIMARY","description":"A child","visual_prompt":"A child"}],"locations":[]},
       "hook_plan":{"promise":"A greeting"},"scenes":[{"title":"Scene","character_ai_names":["child"],
       "visual_beats":[{"title":"Greeting","visual_intent":"The child greets","character_ai_names":["child"],
        "source_anchor":"😀 He said: Hello.","visual_direction":{"shot_size":"WIDE","camera_angle":"EYE_LEVEL", "lens_mm":35,
        "focus_target":"child","action_phase":"BEFORE","subject_placement":"center","background":"room",
        "motivated_light":"soft","palette":"warm","camera_movement":"NONE","movement_intensity":"SUBTLE","crop_safe_area":"full"},
        "audio_cues":[{"cue_type":"DIALOGUE","speaker_ai_name":"child","source_anchor":"Hello.",
          "adaptation_action":"KEEP_EXACT","adapted_text":"Hello.","delivery_hint":"warm"}]}]}]}
      """;

  private final List<AudioCueRow> cues = new ArrayList<>();
  private final List<HookPlanRow> hooks = new ArrayList<>();
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
    when(storyboard.insertStoryBeat(any())).thenReturn(storyBeatId);
    when(storyboard.insertVisualBeat(any())).thenReturn(UUID.randomUUID());
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
  void attachesDialogueToItsCanonicalBeatWithGlobalUtf16Offsets() {
    materializer.materialize(job, PAYLOAD.getBytes(StandardCharsets.UTF_8));
    assertThat(cues).hasSize(1);
    AudioCueRow cue = cues.getFirst();
    assertThat(cue.getStoryBeatId()).isEqualTo(storyBeatId);
    assertThat(cue.getSpeakerProjectCharacterId()).isEqualTo(participantId);
    assertThat(cue.getSourceStart()).isEqualTo(12);
    assertThat(cue.getSourceEnd()).isEqualTo(18);
    assertThat(cue.getAdaptedText()).isEqualTo("Hello.");
    assertThat(cue.getCueType()).isEqualTo("DIALOGUE");
    assertThat(cue.getStatus()).isEqualTo("DRAFT");
    assertThat(cue.getAudioStartMs()).isNull();
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
  void rejectsAnInvalidAnchorBeforeRetentionWrites() {
    String payload =
        PAYLOAD.replace(
            "\"source_anchor\":\"😀 He said: Hello.\"", "\"source_anchor\":\"missing source\"");
    assertThatThrownBy(
            () -> materializer.materialize(job, payload.getBytes(StandardCharsets.UTF_8)))
        .isInstanceOf(IllegalArgumentException.class);
    assertThat(hooks).isEmpty();
  }
}
