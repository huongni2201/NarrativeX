package com.narrativex.backend.feature.generation.infrastructure.analysis.vertex;

import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisException;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisRequest;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisResult;
import com.narrativex.backend.feature.generation.application.port.out.ChapterAnalysisProvider;

/** Fallback provider bean when Vertex AI is not enabled. */
public class DisabledChapterAnalysisProvider implements ChapterAnalysisProvider {

  @Override
  public ChapterAnalysisResult analyze(ChapterAnalysisRequest request) {
    throw new ChapterAnalysisException.ProviderUnavailableException(
        "Vertex AI Gemini provider is disabled. Enable narrativex.providers.vertex-gemini.enabled=true to analyze chapters.");
  }

  @Override
  public int countTokens(String text) {
    return text != null ? text.length() / 4 : 0;
  }
}
