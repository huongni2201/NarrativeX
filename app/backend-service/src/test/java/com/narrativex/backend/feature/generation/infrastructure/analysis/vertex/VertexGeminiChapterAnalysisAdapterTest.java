package com.narrativex.backend.feature.generation.infrastructure.analysis.vertex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisException;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisRequest;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisResult;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisUsage;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class VertexGeminiChapterAnalysisAdapterTest {

  private VertexGeminiProperties properties;
  private VertexGeminiClient client;
  private VertexGeminiChapterAnalysisAdapter adapter;

  @BeforeEach
  void setUp() {
    properties = new VertexGeminiProperties();
    properties.setEnabled(true);
    properties.setSoftInputTokenLimit(800000);
    properties.setModel("gemini-3.8-flash");

    client = mock(VertexGeminiClient.class);
    adapter = new VertexGeminiChapterAnalysisAdapter(properties, client);
  }

  @Test
  void throwsContextTooLargeWhenInputExceedsSoftLimit() {
    when(client.countTokens(anyString())).thenReturn(850000);

    var request =
        ChapterAnalysisRequest.simple(UUID.randomUUID(), UUID.randomUUID(), "Very long chapter", "vi");

    var exc =
        assertThrows(
            ChapterAnalysisException.ContextTooLargeException.class,
            () -> adapter.analyze(request));

    assertEquals(850000, exc.getTokenCount());
    assertEquals(800000, exc.getLimit());
  }

  @Test
  void executesGenerationAndComputesCanonHashWhenWithinLimit() {
    when(client.countTokens(anyString())).thenReturn(15000);
    ChapterAnalysisUsage usage = new ChapterAnalysisUsage(15000, 3000, 2000, 0, 18000, 1200);
    when(client.generateContent(anyString(), anyString(), anyString(), anyString()))
        .thenReturn(new VertexGeminiClient.GeneratedAnalysisResponse("{\"scenes\":[]}", usage));

    var request =
        ChapterAnalysisRequest.simple(UUID.randomUUID(), UUID.randomUUID(), "Normal chapter text", "vi");

    ChapterAnalysisResult result = adapter.analyze(request);
    assertNotNull(result);
    assertEquals("{\"scenes\":[]}", result.rawJson());
    assertEquals("gemini-3.8-flash", result.model());
    assertNotNull(result.canonHash());
    assertEquals(18000, result.usage().totalTokens());
    assertEquals(2000, result.usage().thinkingTokens());
  }

  @Test
  void countTokensHandlesEmptyString() {
    assertEquals(0, adapter.countTokens(""));
    assertEquals(0, adapter.countTokens(null));
  }
}
