package com.narrativex.backend.feature;

import static org.junit.jupiter.api.Assertions.assertThrows;

import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import com.narrativex.backend.feature.project.domain.exception.InvalidStoryVersionTransitionException;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class P1RegressionTest {

  @Test
  void invalidStoryVersionTransitionIsADomainConflict() {
    var version = StoryVersion.create(UUID.randomUUID(), 1, "story", "vi");
    version.activate();

    assertThrows(InvalidStoryVersionTransitionException.class, version::activate);
  }
}
