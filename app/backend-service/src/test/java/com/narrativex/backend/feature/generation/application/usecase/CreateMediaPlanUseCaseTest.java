package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.application.command.CreateMediaPlanCommand;
import com.narrativex.backend.feature.generation.application.port.out.MediaPlanRepository;
import com.narrativex.backend.feature.generation.application.service.MotionStrategyResolver;
import com.narrativex.backend.feature.generation.domain.aggregate.MediaPlan;
import com.narrativex.backend.feature.generation.domain.enums.MotionStrategy;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
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
    var storyVersionAccess = mock(StoryVersionAccess.class);
    var chapterSourceAccess = mock(ChapterAnalysisSourceAccess.class);
    var mediaPlanningSourceAccess = mock(MediaPlanningSourceAccess.class);
    var mediaPlanRepository = mock(MediaPlanRepository.class);
    var resolver = new MotionStrategyResolver();
    var useCase =
        new CreateMediaPlanUseCase(
            currentUserId,
            storyVersionAccess,
            chapterSourceAccess,
            mediaPlanningSourceAccess,
            mediaPlanRepository,
            resolver);

    when(currentUserId.get()).thenReturn("user-1");
    when(chapterSourceAccess.requireForAnalysisLocked(10L))
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
                            new BeatSnapshot(
                                40L, 0, "Character runs", MotionIntent.AI_VIDEO)))))));
    when(mediaPlanRepository.nextRevision(10L)).thenReturn(3);
    when(mediaPlanRepository.save(any(MediaPlan.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    var plan =
        useCase.execute(
            new CreateMediaPlanCommand(
                1L, 10L, ProductionMode.HYBRID_LOCAL_I2V, new BigDecimal("1.25")));

    verify(storyVersionAccess).requireOwnedStoryVersion(1L, 20L, "user-1");
    assertThat(plan.chapterId()).isEqualTo(10L);
    assertThat(plan.chapterRowVersion()).isEqualTo(7L);
    assertThat(plan.sourceHash()).isEqualTo("source-hash");
    assertThat(plan.revision()).isEqualTo(3);
    assertThat(plan.productionMode()).isEqualTo(ProductionMode.HYBRID_LOCAL_I2V);
    assertThat(plan.scenes().getFirst().beats().getFirst().motionStrategy())
        .isEqualTo(MotionStrategy.IMAGE_TO_VIDEO);
    assertThat(plan.workload().narrationCharacters()).isEqualTo(5);
    assertThat(plan.workload().imageGenerateCount()).isEqualTo(1);
    assertThat(plan.workload().plannedI2vSeconds()).isEqualTo(8);
    assertThat(plan.workload().basicMotionSeconds()).isZero();
  }
}
