package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.application.command.CreateMediaPlanCommand;
import com.narrativex.backend.feature.generation.application.port.out.MediaPlanRepository;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.CharacterCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.LocationCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.VisualPromptContext;
import com.narrativex.backend.feature.generation.application.service.DefaultMotionExecutionPolicy;
import com.narrativex.backend.feature.generation.application.service.MotionStrategyResolver;
import com.narrativex.backend.feature.generation.application.service.VisualPromptComposer;
import com.narrativex.backend.feature.generation.domain.aggregate.MediaPlan;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import com.narrativex.backend.feature.generation.domain.enums.MotionStrategy;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSource;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource.BeatSnapshot;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource.MotionIntent;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource.SceneSnapshot;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSourceAccess;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class CreateMediaPlanUseCaseTest {

  @Test
  void pinsLockedChapterSnapshotAndResolvesExecutionStrategy() {
    var currentUserId = mock(CurrentUserId.class);
    var chapterSourceAccess = mock(ChapterAnalysisSourceAccess.class);
    var mediaPlanningSourceAccess = mock(MediaPlanningSourceAccess.class);
    var mediaPlanRepository = mock(MediaPlanRepository.class);
    var visualPromptContextRepository = mock(VisualPromptContextRepository.class);
    var resolver = new MotionStrategyResolver(new DefaultMotionExecutionPolicy());
    var useCase =
        new CreateMediaPlanUseCase(
            currentUserId,
            chapterSourceAccess,
            mediaPlanningSourceAccess,
            mediaPlanRepository,
            resolver,
            visualPromptContextRepository,
            new VisualPromptComposer());

    when(currentUserId.get()).thenReturn("user-1");
    when(chapterSourceAccess.requireOwnedForAnalysisLocked(1L, 10L, "user-1"))
        .thenReturn(new ChapterAnalysisSource(10L, 20L, 7L, "source-hash", "source text"));
    when(mediaPlanningSourceAccess.requireCurrent(10L))
        .thenReturn(
            new MediaPlanningSource(
                List.of(
                    new SceneSnapshot(
                        30L,
                        0,
                        "Hello",
                        8,
                        List.of(
                            new BeatSnapshot(40L, 0, "Character runs", MotionIntent.AI_VIDEO))))));
    when(visualPromptContextRepository.findForScene(1L, 30L))
        .thenReturn(
            new VisualPromptContext(
                new LocationCanon(80L, "Old apartment", "small aging apartment", "warm dim apartment"),
                List.of(
                    new CharacterCanon(
                        90L,
                        91L,
                        "Lan",
                        3,
                        "Vietnamese woman with oval face and shoulder-length black hair",
                        "beige cardigan and white blouse",
                        "mid twenties",
                        "shoulder-length straight black hair",
                        null,
                        "beige cardigan and white blouse"))));
    when(mediaPlanRepository.nextRevision(10L)).thenReturn(3);
    when(mediaPlanRepository.save(any(MediaPlan.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    var plan =
        useCase.execute(
            new CreateMediaPlanCommand(
                1L,
                10L,
                ProductionMode.HYBRID_LOCAL_I2V,
                new BigDecimal("1.25"),
                "16:9",
                "STANDARD",
                "vertex",
                "gemini-2.5-flash-image",
                null,
                null,
                ImageStyle.CINEMATIC));

    var beat = plan.scenes().getFirst().beats().getFirst();
    assertThat(plan.chapterId()).isEqualTo(10L);
    assertThat(plan.chapterRowVersion()).isEqualTo(7L);
    assertThat(plan.sourceHash()).isEqualTo("source-hash");
    assertThat(plan.revision()).isEqualTo(3);
    assertThat(plan.productionMode()).isEqualTo(ProductionMode.HYBRID_LOCAL_I2V);
    assertThat(beat.motionStrategy()).isEqualTo(MotionStrategy.IMAGE_TO_VIDEO);
    assertThat(beat.promptTemplateVersion()).isEqualTo("prompt-v3-cinematic");
    assertThat(beat.promptSnapshot())
        .contains("GLOBAL VISUAL STYLE: cinematic visual storytelling")
        .contains("SCENE DESCRIPTION: Character runs")
        .contains("LOCATION CONTINUITY: Old apartment")
        .contains("CHARACTER CONTINUITY")
        .contains("Lan")
        .contains("shoulder-length black hair")
        .contains("beige cardigan and white blouse");
    assertThat(beat.characterSnapshotJson())
        .contains("\"canonicalName\":\"Lan\"")
        .contains("\"versionNumber\":3")
        .contains("\"appearancePrompt\":\"beige cardigan and white blouse\"");
    assertThat(beat.negativePrompt()).contains("inconsistent face");
    assertThat(plan.workload().narrationCharacters()).isEqualTo(5);
    assertThat(plan.workload().imageGenerateCount()).isEqualTo(1);
    assertThat(plan.workload().plannedI2vSeconds()).isEqualTo(8);
    assertThat(plan.workload().basicMotionSeconds()).isZero();
  }

  @Test
  void imageMotionDoesNotRequireUnwiredNarrationSetPointers() {
    var currentUserId = mock(CurrentUserId.class);
    var chapterSourceAccess = mock(ChapterAnalysisSourceAccess.class);
    var mediaPlanningSourceAccess = mock(MediaPlanningSourceAccess.class);
    var mediaPlanRepository = mock(MediaPlanRepository.class);
    var visualPromptContextRepository = mock(VisualPromptContextRepository.class);
    var useCase =
        new CreateMediaPlanUseCase(
            currentUserId,
            chapterSourceAccess,
            mediaPlanningSourceAccess,
            mediaPlanRepository,
            new MotionStrategyResolver(new DefaultMotionExecutionPolicy()),
            visualPromptContextRepository,
            new VisualPromptComposer());

    when(currentUserId.get()).thenReturn("user-1");
    when(chapterSourceAccess.requireOwnedForAnalysisLocked(1L, 10L, "user-1"))
        .thenReturn(new ChapterAnalysisSource(10L, 20L, 7L, "source-hash", "source text"));
    when(mediaPlanningSourceAccess.requireCurrent(10L))
        .thenReturn(
            new MediaPlanningSource(
                List.of(
                    new SceneSnapshot(
                        30L,
                        0,
                        "Hello",
                        8,
                        List.of(new BeatSnapshot(40L, 0, "Character runs", MotionIntent.STILL))))));
    when(visualPromptContextRepository.findForScene(1L, 30L))
        .thenReturn(VisualPromptContext.empty());
    when(mediaPlanRepository.nextRevision(10L)).thenReturn(1);
    when(mediaPlanRepository.save(any(MediaPlan.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    var plan =
        useCase.execute(
            new CreateMediaPlanCommand(
                1L,
                10L,
                ProductionMode.IMAGE_MOTION,
                new BigDecimal("0.25"),
                "16:9",
                "STANDARD",
                "vertex",
                "gemini-2.5-flash-image",
                null,
                null,
                ImageStyle.CINEMATIC));

    assertThat(plan.productionMode()).isEqualTo(ProductionMode.IMAGE_MOTION);
    assertThat(plan.narrationSetId()).isNull();
    assertThat(plan.narrationAlignmentRunId()).isNull();
    assertThat(plan.scenes().getFirst().beats().getFirst().motionStrategy())
        .isEqualTo(MotionStrategy.BASIC_IMAGE_MOTION);
    assertThat(plan.scenes().getFirst().beats().getFirst().characterSnapshotJson())
        .isEqualTo("{\"characters\":[]}");
  }
}
