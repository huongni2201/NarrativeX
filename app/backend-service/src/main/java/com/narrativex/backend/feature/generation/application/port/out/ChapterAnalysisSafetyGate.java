package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSource;

public interface ChapterAnalysisSafetyGate {
  void requireAllowed(Long projectId, ChapterAnalysisSource source);
}
