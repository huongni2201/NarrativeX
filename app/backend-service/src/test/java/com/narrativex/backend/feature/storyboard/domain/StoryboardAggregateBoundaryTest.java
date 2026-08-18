package com.narrativex.backend.feature.storyboard.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.narrativex.backend.feature.common.domain.AggregateRoot;
import com.narrativex.backend.feature.common.domain.DomainEntity;
import com.narrativex.backend.feature.storyboard.domain.aggregate.Chapter;
import com.narrativex.backend.feature.storyboard.domain.aggregate.Scene;
import com.narrativex.backend.feature.storyboard.domain.entity.VisualBeat;
import org.junit.jupiter.api.Test;

class StoryboardAggregateBoundaryTest {

  @Test
  void chapterAndSceneAreIndependentAggregateRoots() {
    assertEquals(AggregateRoot.class, Chapter.class.getSuperclass());
    assertEquals(AggregateRoot.class, Scene.class.getSuperclass());
  }

  @Test
  void visualBeatRemainsAChildDomainEntity() {
    assertEquals(DomainEntity.class, VisualBeat.class.getSuperclass());
  }

  @Test
  void aggregateReferencesMustBeValid() {
    assertThrows(IllegalArgumentException.class, () -> new Chapter(0L, 0, "Chapter"));
    assertThrows(IllegalArgumentException.class, () -> new Scene(0L, 0, "Scene"));
  }
}
