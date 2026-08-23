package com.narrativex.backend.feature.storyboard.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.narrativex.backend.feature.common.domain.AggregateRoot;
import com.narrativex.backend.feature.common.domain.DomainEntity;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.storyboard.domain.aggregate.Chapter;
import com.narrativex.backend.feature.storyboard.domain.aggregate.Scene;
import com.narrativex.backend.feature.storyboard.domain.entity.VisualBeat;
import com.narrativex.backend.feature.storyboard.domain.enums.SceneStatus;
import com.narrativex.backend.feature.storyboard.domain.exception.InvalidSceneTransitionException;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class StoryboardAggregateBoundaryTest {

  @Test
  void chapterAndSceneAreIndependentAggregateRoots() {
    assertEquals(AggregateRoot.class, Chapter.class.getSuperclass().getSuperclass());
    assertEquals(AggregateRoot.class, Scene.class.getSuperclass().getSuperclass());
  }

  @Test
  void visualBeatRemainsAChildDomainEntity() {
    assertEquals(DomainEntity.class, VisualBeat.class.getSuperclass());
  }

  @Test
  void aggregateReferencesMustBeValid() {
    assertThrows(NullPointerException.class, () -> new Chapter(null, 0, "Chapter"));
    assertThrows(NullPointerException.class, () -> new Scene(null, 0, "Scene"));
  }

  @Test
  void chapterOwnsItsTitleAndOrderRules() {
    UUID storyVersionId = UuidV7.random();
    Chapter chapter = new Chapter(storyVersionId, 0, "Chapter 1");

    chapter.rename("Opening");
    chapter.reorder(2);

    assertEquals("Opening", chapter.getTitle());
    assertEquals(2, chapter.getOrderIndex());
    assertThrows(IllegalArgumentException.class, () -> chapter.reorder(-1));
    assertThrows(IllegalArgumentException.class, () -> chapter.rename(" "));
  }

  @Test
  void sceneOwnsCanonicalLifecycleTransitions() {
    UUID chapterId = UuidV7.random();
    Scene scene = new Scene(chapterId, 0, "Scene 1");

    assertEquals(SceneStatus.DRAFT, scene.getStatus());
    scene.markReadyForVisual();
    assertEquals(SceneStatus.READY_FOR_VISUAL, scene.getStatus());
    scene.startGeneration();
    assertEquals(SceneStatus.GENERATING, scene.getStatus());
    scene.submitForReview();
    assertEquals(SceneStatus.REVIEW, scene.getStatus());
    scene.approve();
    assertEquals(SceneStatus.APPROVED, scene.getStatus());
  }

  @Test
  void sceneRejectsInvalidLifecycleTransitions() {
    UUID chapterId = UuidV7.random();
    Scene scene = new Scene(chapterId, 0, "Scene 1");

    assertThrows(InvalidSceneTransitionException.class, scene::startGeneration);

    scene.markReadyForVisual();
    scene.startGeneration();
    assertThrows(InvalidSceneTransitionException.class, () -> scene.updateNarration("changed"));
  }

  @Test
  void editingApprovedSceneMarksItsSnapshotOutdated() {
    UUID sceneId = UuidV7.random();
    UUID chapterId = UuidV7.random();
    Scene scene = Scene.rehydrate(sceneId, 3L, chapterId, 0, "Scene 1", "Narration", 12, SceneStatus.APPROVED);

    scene.updateNarration("Updated narration");

    assertEquals("Updated narration", scene.getNarration());
    assertEquals(SceneStatus.OUTDATED, scene.getStatus());
  }
}
