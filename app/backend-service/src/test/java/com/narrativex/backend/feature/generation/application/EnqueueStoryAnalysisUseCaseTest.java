package com.narrativex.backend.feature.generation.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.narrativex.backend.feature.generation.application.command.EnqueueStoryAnalysisCommand;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import org.junit.jupiter.api.Test;

class EnqueueStoryAnalysisUseCaseTest {

  @Test
  void chapterAnalysisHasADurableJobType() {
    assertEquals("CHAPTER_ANALYZE", JobType.CHAPTER_ANALYZE.name());
  }

  @Test
  void analysisCommandRequiresAValidProjectAndChapterScope() {
    assertThrows(IllegalArgumentException.class, () -> new EnqueueStoryAnalysisCommand(null, 11L));
    assertThrows(IllegalArgumentException.class, () -> new EnqueueStoryAnalysisCommand(7L, null));
    assertThrows(IllegalArgumentException.class, () -> new EnqueueStoryAnalysisCommand(0L, 11L));
    assertThrows(IllegalArgumentException.class, () -> new EnqueueStoryAnalysisCommand(7L, 0L));
  }
}
