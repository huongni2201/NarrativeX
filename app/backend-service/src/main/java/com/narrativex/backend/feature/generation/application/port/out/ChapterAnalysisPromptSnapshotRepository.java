package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisPromptSnapshot;
import java.util.Optional;
import java.util.UUID;

/** Insert-only store for the Chapter Analysis instruction frozen at admission. */
public interface ChapterAnalysisPromptSnapshotRepository {
  void save(ChapterAnalysisPromptSnapshot snapshot);

  Optional<ChapterAnalysisPromptSnapshot> find(UUID generationJobId);
}
