package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.application.command.CreateMediaPlanCommand;
import com.narrativex.backend.feature.generation.application.port.out.MediaPlanRepository;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.VisualPromptContext;
import com.narrativex.backend.feature.generation.application.service.DefaultMotionExecutionPolicy;
import com.narrativex.backend.feature.generation.application.service.MediaPlanSceneResolver;
import com.narrativex.backend.feature.generation.application.service.MotionStrategyResolver;
import com.narrativex.backend.feature.generation.application.service.VisualPromptComposer;
import com.narrativex.backend.feature.generation.domain.aggregate.MediaPlan;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.generation.domain.value.MediaBeatPlan;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSource;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource.BeatSnapshot;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource.MotionIntent;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource.SceneSnapshot;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSourceAccess;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class CreateMediaPlanNoReuseTest {

  @Test
  void alwaysGeneratesFreshImageForEveryVisualBeat() {
    var currentUserId = mock(CurrentUserId.class);
    var chapterSourceAccess = mock(ChapterAnalysisSourceAccess.class);
    var mediaPlanningSourceAccess = mock(MediaPlanningSourceAccess.class);
    var mediaPlanRepository = mock(MediaPlanRepository.class);
    var visualPromptContextRepository = mock(VisualPromptContextRepository.class);
    var sceneResolver =
        new MediaPlanSceneResolver(
            new MotionStrategyResolver(new DefaultMotionExecutionPolicy()),
            visualPromptContextRepository,
            new VisualPromptComposer(new ObjectMapper()));
    var useCase =
        new CreateMediaPlanUseCase(
            currentUserId,
            chapterSourceAccess,
            mediaPlanningSourceAccess,
            mediaPlanRepository,
            sceneResolver);

    UUID projectId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    UUID storyVersionId = UUID.randomUUID();
    UUID firstBeatId = UUID.randomUUID();
    UUID secondBeatId = UUID.randomUUID();

    when(currentUserId.get()).thenReturn("user-1");
    when(chapterSourceAccess.requireOwnedForAnalysisLocked(projectId, chapterId, "user-1"))
        .thenReturn(
            new ChapterAnalysisSource(chapterId, storyVersionId, 7L, "source-hash", "source text"));
    when(mediaPlanningSourceAccess.requireCurrent(chapterId))
        .thenReturn(
            new MediaPlanningSource(
                List.of(
                    new SceneSnapshot(
                        UUID.randomUUID(),
                        0,
                        "Narration",
                        8,
                        List.of(
                            new BeatSnapshot(
                                firstBeatId,
                                0,
                                "Same subject in the same room",
                                MotionIntent.STILL),
                            new BeatSnapshot(
                                secondBeatId,
                                1,
                                "Same subject in the same room",
                                MotionIntent.STILL)))),
                UUID.randomUUID(),
                "source-hash",
                null,
                null));
    when(visualPromptContextRepository.findForBeat(projectId, firstBeatId))
        .thenReturn(VisualPromptContext.empty());
    when(visualPromptContextRepository.findForBeat(projectId, secondBeatId))
        .thenReturn(VisualPromptContext.empty());
    when(mediaPlanRepository.nextRevision(chapterId)).thenReturn(1);
    when(mediaPlanRepository.save(any(MediaPlan.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    MediaPlan plan =
        useCase.execute(
            new CreateMediaPlanCommand(
                projectId,
                chapterId,
                ProductionMode.IMAGE_MOTION,
                new BigDecimal("1.00"),
                "16:9",
                "vertex",
                "gemini-2.5-flash-image",
                null,
                null,
                ImageStyle.CINEMATIC));

    assertThat(plan.scenes().getFirst().beats())
        .extracting(MediaBeatPlan::assetStrategy)
        .containsExactly("GENERATE_NEW", "GENERATE_NEW");
    assertThat(plan.scenes().getFirst().beats())
        .extracting(MediaBeatPlan::reuseSourceVisualBeatId)
        .containsOnlyNulls();
    assertThat(plan.workload().imageGenerateCount()).isEqualTo(2);
  }
}
