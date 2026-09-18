package com.narrativex.backend.feature.generation.application.model.analysis;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import org.junit.jupiter.api.Test;

class ChapterAnalysisModelsTest {

  @Test
  void requestRequiresMandatoryFields() {
    UUID projectId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();

    assertThrows(
        NullPointerException.class,
        () ->
            new ChapterAnalysisRequest(
                null, chapterId, null, "text", "vi", "1.0", "1.0", null, null));
    assertThrows(
        NullPointerException.class,
        () ->
            new ChapterAnalysisRequest(
                projectId, null, null, "text", "vi", "1.0", "1.0", null, null));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            new ChapterAnalysisRequest(
                projectId, chapterId, null, "  ", "vi", "1.0", "1.0", null, null));

    ChapterAnalysisRequest request =
        ChapterAnalysisRequest.simple(projectId, chapterId, "valid text", null);
    assertEquals("vi", request.sourceLanguage());
    assertEquals("1.0", request.promptVersion());
    assertEquals("1.0", request.schemaVersion());
  }

  @Test
  void usageEnforcesNonNegativeValues() {
    assertThrows(
        IllegalArgumentException.class, () -> new ChapterAnalysisUsage(-1, 10, 5, 0, 15, 100));

    ChapterAnalysisUsage usage = new ChapterAnalysisUsage(100, 50, 20, 10, 150, 500);
    assertEquals(100, usage.promptTokens());
    assertEquals(50, usage.outputTokens());
    assertEquals(20, usage.thinkingTokens());
    assertEquals(10, usage.cachedTokens());
    assertEquals(150, usage.totalTokens());
    assertEquals(500, usage.runtimeMs());
  }

  @Test
  void resultContainsAllMetadata() {
    ChapterAnalysisUsage usage = ChapterAnalysisUsage.zero();
    ChapterAnalysisResult result =
        new ChapterAnalysisResult("{}", usage, "gemini-3.8-flash", "hash123");
    assertEquals("{}", result.rawJson());
    assertEquals("gemini-3.8-flash", result.model());
    assertEquals("hash123", result.canonHash());
    assertNotNull(result.usage());
  }

  @Test
  void exceptionClassifiesRetryability() {
    var contextTooLarge = new ChapterAnalysisException.ContextTooLargeException(900000, 800000);
    assertFalse(contextTooLarge.isRetryable());
    assertEquals(900000, contextTooLarge.getTokenCount());
    assertEquals(800000, contextTooLarge.getLimit());

    var rateLimit = new ChapterAnalysisException.RateLimitException("Rate limit 429");
    assertTrue(rateLimit.isRetryable());

    var unavailable = new ChapterAnalysisException.ProviderUnavailableException("Timeout 503");
    assertTrue(unavailable.isRetryable());

    var validation = new ChapterAnalysisException.ValidationException("Invalid schema");
    assertFalse(validation.isRetryable());
  }
}
