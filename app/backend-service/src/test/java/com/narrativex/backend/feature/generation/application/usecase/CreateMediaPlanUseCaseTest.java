package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.uuid.UuidV7;
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
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class CreateMediaPlanUseCaseTest {

  @Test
  void pinsLockedChapterSnapshotAndResolvesCurrentExecutionStrategy() {
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
            new VisualPromptComposer(new ObjectMapper()));

    UUID projectId = UuidV7.random();
    UUID chapterId = UuidV7.random();
    UUID storyVersionId = UuidV7.random();
    UUID sceneId = UuidV7.random();
    UUID beatId = UuidV7.random();
    UUID locationId = UuidV7.random();
    UUID assignmentId = UuidV7.random();
    UUID characterId = UuidV7.random();

    when(currentUserId.get()).thenReturn("user-1");
    when(chapterSourceAccess.requireOwnedForAnalysisLocked(projectId, chapterId, "user-1"))
        .thenReturn(
            new ChapterAnalysisSource(chapterId, storyVersionId, 7L, "source-hash", "source text"));
    when(mediaPlanningSourceAccess.requireCurrent(chapterId))
        .thenReturn(
            new MediaPlanningSource(
                List.of(
                    new SceneSnapshot(
                        sceneId,
                        0,
                        "Hello",
                        8,
                        List.of(
                            new BeatSnapshot(
                                beatId, 0, "Character runs", MotionIntent.AI_VIDEO))))));
    when(visualPromptContextRepository.findForBeat(projectId, beatId))
        .thenReturn(
            new VisualPromptContext(
                new LocationCanon(
                    locationId, "Old apartment", "small aging apartment", "warm dim apartment"),
                List.of(
                    new CharacterCanon(
                        assignmentId,
                        characterId,
                        "Lan",
                        3,
                        "Vietnamese woman with oval face and shoulder-length black hair",
                        "beige cardigan and white blouse",
                        "mid twenties",
                        "shoulder-length straight black hair",
                        null,
                        "beige cardigan and white blouse",
                        "PRIMARY",
                        List.of()))));
    when(mediaPlanRepository.nextRevision(chapterId)).thenReturn(3);
    when(mediaPlanRepository.save(any(MediaPlan.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    var plan =
        useCase.execute(
            new CreateMediaPlanCommand(
                projectId,
                chapterId,
                ProductionMode.IMAGE_MOTION,
                new BigDecimal("1.25"),
                "16:9",
                "STANDARD",
                "vertex",
                "gemini-2.5-flash-image",
                null,
                null,
                ImageStyle.CINEMATIC));

    assertThat(plan.chapterId()).isEqualTo(chapterId);
    assertThat(plan.chapterRowVersion()).isEqualTo(7L);
    assertThat(plan.revision()).isEqualTo(3);
    assertThat(plan.productionMode()).isEqualTo(ProductionMode.IMAGE_MOTION);
    assertThat(plan.scenes()).hasSize(1);
    assertThat(plan.scenes().getFirst().beats()).hasSize(1);
    assertThat(plan.scenes().getFirst().beats().getFirst().motionStrategy())
        .isEqualTo(MotionStrategy.BASIC_IMAGE_MOTION);
    assertThat(plan.scenes().getFirst().beats().getFirst().promptSnapshot())
        .contains("Vietnamese woman with oval face")
        .contains("[PRIMARY]");
    assertThat(plan.scenes().getFirst().beats().getFirst().characterSnapshotJson())
        .contains("\"canonicalName\":\"Lan\"")
        .contains("\"versionNumber\":3")
        .contains("\"beatRole\":\"PRIMARY\"");
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
            new VisualPromptComposer(new ObjectMapper()));

    UUID projectId = UuidV7.random();
    UUID chapterId = UuidV7.random();
    UUID storyVersionId = UuidV7.random();
    UUID sceneId = UuidV7.random();
    UUID beatId = UuidV7.random();

    when(currentUserId.get()).thenReturn("user-1");
    when(chapterSourceAccess.requireOwnedForAnalysisLocked(projectId, chapterId, "user-1"))
        .thenReturn(
            new ChapterAnalysisSource(chapterId, storyVersionId, 7L, "source-hash", "source text"));
    when(mediaPlanningSourceAccess.requireCurrent(chapterId))
        .thenReturn(
            new MediaPlanningSource(
                List.of(
                    new SceneSnapshot(
                        sceneId,
                        0,
                        "Hello",
                        8,
                        List.of(
                            new BeatSnapshot(beatId, 0, "Character runs", MotionIntent.STILL))))));
    when(visualPromptContextRepository.findForBeat(projectId, beatId))
        .thenReturn(VisualPromptContext.empty());
    when(mediaPlanRepository.nextRevision(chapterId)).thenReturn(1);
    when(mediaPlanRepository.save(any(MediaPlan.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    var plan =
        useCase.execute(
            new CreateMediaPlanCommand(
                projectId,
                chapterId,
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
