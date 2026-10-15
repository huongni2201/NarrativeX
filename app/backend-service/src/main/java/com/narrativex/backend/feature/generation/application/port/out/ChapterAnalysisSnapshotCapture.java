package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;

/** Freezes the selected local execution contract in the admission transaction. */
public interface ChapterAnalysisSnapshotCapture {
  void capture(GenerationJob job);
}
