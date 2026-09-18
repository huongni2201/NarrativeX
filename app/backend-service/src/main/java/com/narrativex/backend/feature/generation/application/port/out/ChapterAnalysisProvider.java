package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisRequest;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisResult;

/**
 * Outbound port for analyzing a chapter into structured scenes and visual beats. Domain and
 * application layers interact solely through this port without importing provider SDKs.
 */
public interface ChapterAnalysisProvider {

  /**
   * Analyzes chapter source text into a structured storyboard document.
   *
   * @param request the analysis request with chapter text and parameters
   * @return the structured result including JSON envelope and token telemetry
   */
  ChapterAnalysisResult analyze(ChapterAnalysisRequest request);

  /**
   * Preflight token count for input text against the provider's tokenizer.
   *
   * @param text the input text
   * @return estimated or exact token count
   */
  int countTokens(String text);
}
