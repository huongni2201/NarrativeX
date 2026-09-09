package com.narrativex.backend.feature.generation.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.port.in.VisualBeatPromptContext;
import com.narrativex.backend.feature.generation.application.port.out.ChapterContinuityRepository;
import com.narrativex.backend.feature.generation.application.port.out.StoryboardGenerationSnapshotRepository;
import com.narrativex.backend.feature.generation.application.port.out.StoryboardGenerationSnapshotRepository.ChapterScope;
import com.narrativex.backend.feature.generation.application.port.out.StoryboardGenerationSnapshotRepository.GenerationBatch;
import com.narrativex.backend.feature.generation.application.service.VisualPromptComposer.ComposedVisualPrompt;
import com.narrativex.backend.feature.generation.application.usecase.PrepareStoryboardGenerationBatchUseCase;
import com.narrativex.backend.feature.storyboard.api.response.ChapterStoryboardResponse;
import com.narrativex.backend.feature.storyboard.api.response.VisualBeatResponse;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardBeatAccess;
import com.narrativex.backend.feature.storyboard.domain.enums.MotionMode;
import com.narrativex.backend.feature.storyboard.domain.enums.SceneStatus;
import com.narrativex.backend.feature.storyboard.domain.enums.VisualBeatReviewStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class PrepareStoryboardGenerationBatchUseCaseTest {
  private final UUID projectId = UuidV7.random();
  private final UUID chapterId = UuidV7.random();
  private final UUID sceneId = UuidV7.random();
  private final UUID beatOne = UuidV7.random();
  private final UUID beatTwo = UuidV7.random();
  private final UUID revisionId = UuidV7.random();
  private final String sourceHash = "a".repeat(64);

  @Test
  void sameIdempotencyKeyAndSameScopeReturnsOriginalBatch() {
    Fixture fixture = fixture();

    var first = fixture.useCase.execute(projectId, chapterId, List.of(beatOne), null, "same-key");
    var second = fixture.useCase.execute(projectId, chapterId, List.of(beatOne), null, "same-key");

    assertEquals(first.batch().id(), second.batch().id());
    assertEquals(first.batch().requestFingerprint(), second.batch().requestFingerprint());
    assertEquals(fixture.stored.get().id(), second.batch().id());
  }

  @Test
  void sameIdempotencyKeyWithDifferentBlockedBeatScopeIsRejected() {
    Fixture fixture = fixture();
    when(fixture.promptContext.prepare(eq(projectId), eq(chapterId), any(UUID.class)))
        .thenThrow(
            new ResourceConflictException("REFERENCE_BUDGET_EXCEEDED: required refs exceed 3"));

    var first = fixture.useCase.execute(projectId, chapterId, List.of(beatOne), null, "scope-key");
    assertTrue(first.hasBlockingIssues());
    assertTrue(first.batch().beats().isEmpty());

    assertThrows(
        ResourceConflictException.class,
        () -> fixture.useCase.execute(projectId, chapterId, List.of(beatTwo), null, "scope-key"));
  }

  @Test
  void staleCheckDetectsCanonOrPromptChangeWithoutSourceRevisionChange() {
    Fixture fixture = fixture();
    var first = fixture.useCase.execute(projectId, chapterId, List.of(beatOne), null, "stale-key");
    assertFalse(first.stale());

    when(fixture.promptContext.prepare(projectId, chapterId, beatOne))
        .thenReturn(prepared(beatOne, "PROMPT AFTER CANON CHANGE"));

    var reloaded = fixture.useCase.get(projectId, chapterId, first.batch().id());
    assertTrue(reloaded.stale());
  }

  @Test
  void expectedStoryboardRevisionMismatchFailsBeforeSnapshotCreation() {
    Fixture fixture = fixture();
    UUID oldRevision = UuidV7.random();

    assertThrows(
        ResourceConflictException.class,
        () ->
            fixture.useCase.execute(
                projectId, chapterId, List.of(beatOne), oldRevision, "revision-key"));
    assertEquals(null, fixture.stored.get());
  }

  private Fixture fixture() {
    StoryboardBeatAccess storyboard = mock(StoryboardBeatAccess.class);
    VisualBeatPromptContext promptContext = mock(VisualBeatPromptContext.class);
    ChapterContinuityRepository continuity = mock(ChapterContinuityRepository.class);
    StoryboardGenerationSnapshotRepository snapshots =
        mock(StoryboardGenerationSnapshotRepository.class);
    AtomicReference<GenerationBatch> stored = new AtomicReference<>();

    when(storyboard.requireCurrentBeatIds(projectId, chapterId))
        .thenReturn(java.util.Set.of(beatOne, beatTwo));
    when(snapshots.findCurrentScope(projectId, chapterId))
        .thenReturn(Optional.of(new ChapterScope(revisionId, sourceHash)));
    when(continuity.findCurrent(projectId, chapterId)).thenReturn(Optional.empty());
    when(snapshots.findByIdempotencyKey(eq(projectId), eq(chapterId), any(String.class)))
        .thenAnswer(
            invocation -> {
              GenerationBatch batch = stored.get();
              if (batch == null) return Optional.empty();
              String key = invocation.getArgument(2);
              return batch.idempotencyKey().equals(key) ? Optional.of(batch) : Optional.empty();
            });
    when(snapshots.findById(eq(projectId), eq(chapterId), any(UUID.class)))
        .thenAnswer(
            invocation -> {
              GenerationBatch batch = stored.get();
              return batch != null && batch.id().equals(invocation.getArgument(2))
                  ? Optional.of(batch)
                  : Optional.empty();
            });
    when(snapshots.save(any(GenerationBatch.class)))
        .thenAnswer(
            invocation -> {
              GenerationBatch batch = invocation.getArgument(0);
              stored.set(batch);
              return batch;
            });
    when(promptContext.prepare(projectId, chapterId, beatOne))
        .thenReturn(prepared(beatOne, "PROMPT ONE"));
    when(promptContext.prepare(projectId, chapterId, beatTwo))
        .thenReturn(prepared(beatTwo, "PROMPT TWO"));

    return new Fixture(
        new PrepareStoryboardGenerationBatchUseCase(
            storyboard, promptContext, continuity, snapshots, new ObjectMapper()),
        promptContext,
        stored);
  }

  private ChapterStoryboardResponse storyboard() {
    return new ChapterStoryboardResponse(
        new ChapterStoryboardResponse.ChapterItem(chapterId, 0, "Chapter"),
        List.of(
            new ChapterStoryboardResponse.SceneItem(
                sceneId,
                0,
                "Scene",
                SceneStatus.READY_FOR_VISUAL,
                0,
                2,
                List.of(beatResponse(beatOne, 0), beatResponse(beatTwo, 1)))));
  }

  private VisualBeatResponse beatResponse(UUID beatId, int orderIndex) {
    return new VisualBeatResponse(
        beatId,
        sceneId,
        orderIndex,
        "Beat " + orderIndex,
        "Visual intent",
        null,
        null,
        MotionMode.STILL,
        VisualBeatReviewStatus.NEEDS_REVIEW,
        null,
        null,
        3L);
  }

  private VisualBeatPromptContext.PreparedVisualBeatPrompt prepared(UUID beatId, String prompt) {
    return new VisualBeatPromptContext.PreparedVisualBeatPrompt(
        beatId, sceneId, 3L, null, null, new ComposedVisualPrompt(prompt, "", "{}", List.of()));
  }

  private record Fixture(
      PrepareStoryboardGenerationBatchUseCase useCase,
      VisualBeatPromptContext promptContext,
      AtomicReference<GenerationBatch> stored) {}
}
