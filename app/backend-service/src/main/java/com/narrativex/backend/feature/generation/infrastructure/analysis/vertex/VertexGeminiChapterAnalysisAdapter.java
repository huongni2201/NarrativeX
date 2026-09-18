package com.narrativex.backend.feature.generation.infrastructure.analysis.vertex;

import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisException;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisRequest;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisResult;
import com.narrativex.backend.feature.generation.application.port.out.ChapterAnalysisProvider;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Concrete infrastructure adapter implementing ChapterAnalysisProvider via Vertex AI Gemini 3.8 Flash.
 */
@Slf4j
@Component
@ConditionalOnProperty(
    prefix = "narrativex.providers.vertex-gemini",
    name = "enabled",
    havingValue = "true",
    matchIfMissing = false)
public class VertexGeminiChapterAnalysisAdapter implements ChapterAnalysisProvider {

  private final VertexGeminiProperties properties;
  private final VertexGeminiClient client;

  public VertexGeminiChapterAnalysisAdapter(
      VertexGeminiProperties properties, VertexGeminiClient client) {
    this.properties = properties;
    this.client = client;
  }

  @Override
  public int countTokens(String text) {
    if (text == null || text.isBlank()) {
      return 0;
    }
    return client.countTokens(text);
  }

  @Override
  public ChapterAnalysisResult analyze(ChapterAnalysisRequest request) {
    log.info(
        "Beginning chapter analysis for chapter {} (model={}, thinking={})",
        request.chapterId(),
        properties.getModel(),
        properties.getThinkingLevel());

    // 1. Preflight token count
    int tokenCount = countTokens(request.sourceText());
    if (tokenCount > properties.getSoftInputTokenLimit()) {
      log.warn(
          "Chapter {} exceeds soft input token limit: {} > {}",
          request.chapterId(),
          tokenCount,
          properties.getSoftInputTokenLimit());
      throw new ChapterAnalysisException.ContextTooLargeException(
          tokenCount, properties.getSoftInputTokenLimit());
    }

    // 2. Execute analysis generation
    VertexGeminiClient.GeneratedAnalysisResponse response =
        client.generateContent(
            request.sourceText(),
            request.sourceLanguage(),
            request.promptVersion(),
            request.schemaVersion());

    // 3. Compute canon fingerprint
    String canonHash = computeSha256(request.sourceText() + ":" + response.rawJson());

    log.info(
        "Chapter analysis completed for chapter {} in {} ms. Tokens: prompt={}, thinking={}, output={}, total={}",
        request.chapterId(),
        response.usage().runtimeMs(),
        response.usage().promptTokens(),
        response.usage().thinkingTokens(),
        response.usage().outputTokens(),
        response.usage().totalTokens());

    return new ChapterAnalysisResult(response.rawJson(), response.usage(), properties.getModel(), canonHash);
  }

  private static String computeSha256(String input) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(hash);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 algorithm not available", e);
    }
  }
}
