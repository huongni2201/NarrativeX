package com.narrativex.backend.feature.generation.infrastructure.analysis.vertex;

import com.google.auth.oauth2.GoogleCredentials;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisException;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisInstructions;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisUsage;
import com.narrativex.backend.feature.generation.infrastructure.analysis.ChapterAnalysisContractResources;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Low-level HTTP client invoking Vertex AI Gemini generateContent and countTokens REST APIs. */
@Slf4j
public class VertexGeminiClient {
  private static final String CLOUD_PLATFORM_SCOPE =
      "https://www.googleapis.com/auth/cloud-platform";
  private final VertexGeminiProperties properties;
  private final HttpClient httpClient;
  private final ObjectMapper objectMapper;
  private final ChapterAnalysisContractResources contractResources;
  private GoogleCredentials credentials;

  public VertexGeminiClient(VertexGeminiProperties properties, ObjectMapper objectMapper) {
    this(
        properties,
        HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build(),
        objectMapper);
  }

  public VertexGeminiClient(
      VertexGeminiProperties properties, HttpClient httpClient, ObjectMapper objectMapper) {
    this.properties = properties;
    this.httpClient = httpClient;
    this.objectMapper = objectMapper;
    this.contractResources = new ChapterAnalysisContractResources(objectMapper);
  }

  /** Preflight counts tokens for input text against the configured Gemini model. */
  public int countTokens(String text) {
    String url = buildEndpointUrl("countTokens");
    Map<String, Object> requestPayload =
        Map.of("contents", List.of(Map.of("role", "user", "parts", List.of(Map.of("text", text)))));

    try {
      String jsonBody = objectMapper.writeValueAsString(requestPayload);
      HttpResponse<String> response = sendHttpRequest(url, jsonBody);

      if (response.statusCode() >= 200 && response.statusCode() < 300) {
        JsonNode root = objectMapper.readTree(response.body());
        JsonNode totalTokensNode = root.get("totalTokens");
        return totalTokensNode != null ? totalTokensNode.asInt() : 0;
      }
      throw mapHttpError(response.statusCode(), response.body());
    } catch (IOException e) {
      throw new ChapterAnalysisException.ProviderUnavailableException(
          "Failed to communicate with Vertex AI countTokens endpoint: " + e.getMessage(), e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new ChapterAnalysisException("Interrupted during token counting", e);
    }
  }

  /** Generates structured storyboard output from chapter text. */
  public GeneratedAnalysisResponse generateContent(
      String sourceText, String sourceLanguage, String promptVersion, String schemaVersion) {
    return generateContent(sourceText, sourceLanguage, promptVersion, schemaVersion, null);
  }

  /** As above, appending the editorial instruction frozen at job admission (may be null). */
  public GeneratedAnalysisResponse generateContent(
      String sourceText,
      String sourceLanguage,
      String promptVersion,
      String schemaVersion,
      String customInstruction) {
    String url = buildEndpointUrl("generateContent");
    Instant startTime = Instant.now();

    Map<String, Object> requestPayload =
        buildGenerateContentPayload(
            sourceText, sourceLanguage, promptVersion, schemaVersion, customInstruction);

    try {
      String jsonBody = objectMapper.writeValueAsString(requestPayload);
      HttpResponse<String> response = sendHttpRequest(url, jsonBody);
      long runtimeMs = Duration.between(startTime, Instant.now()).toMillis();

      if (response.statusCode() >= 200 && response.statusCode() < 300) {
        return parseSuccessfulResponse(response.body(), runtimeMs);
      }
      throw mapHttpError(response.statusCode(), response.body());
    } catch (IOException e) {
      throw new ChapterAnalysisException.ProviderUnavailableException(
          "Failed to communicate with Vertex AI generateContent endpoint: " + e.getMessage(), e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new ChapterAnalysisException("Interrupted during chapter analysis generation", e);
    }
  }

  private Map<String, Object> buildGenerateContentPayload(
      String sourceText,
      String sourceLanguage,
      String promptVersion,
      String schemaVersion,
      String customInstruction) {
    String userPrompt =
        "Extract characters, locations, narrative scenes, and visual beats from this chapter.\n\n"
            + "Source language: "
            + sourceLanguage
            + "\n\n"
            + sourceText;

    String systemInstruction =
        ChapterAnalysisInstructions.compose(
            contractResources.systemInstruction(promptVersion, schemaVersion), customInstruction);
    JsonNode responseSchema = contractResources.vertexResponseSchema();

    Map<String, Object> thinkingConfig =
        "NONE".equalsIgnoreCase(properties.getThinkingLevel())
            ? Map.of("thinkingLevel", "NONE")
            : Map.of("thinkingLevel", properties.getThinkingLevel());

    Map<String, Object> generationConfig =
        Map.of(
            "responseMimeType",
            "application/json",
            "responseSchema",
            responseSchema,
            "thinkingConfig",
            thinkingConfig,
            "maxOutputTokens",
            properties.getMaxOutputTokens(),
            "temperature",
            0.2);

    return Map.of(
        "contents",
        List.of(Map.of("role", "user", "parts", List.of(Map.of("text", userPrompt)))),
        "systemInstruction",
        Map.of("parts", List.of(Map.of("text", systemInstruction))),
        "generationConfig",
        generationConfig);
  }

  private GeneratedAnalysisResponse parseSuccessfulResponse(String responseBody, long runtimeMs) {
    try {
      JsonNode root = objectMapper.readTree(responseBody);
      JsonNode candidates = root.get("candidates");
      if (candidates == null || !candidates.isArray() || candidates.isEmpty()) {
        throw new ChapterAnalysisException.ValidationException(
            "Vertex AI response contained no candidates");
      }

      JsonNode firstCandidate = candidates.get(0);
      JsonNode content = firstCandidate.get("content");
      if (content == null) {
        throw new ChapterAnalysisException.ValidationException(
            "Vertex AI candidate missing content");
      }

      JsonNode parts = content.get("parts");
      if (parts == null || !parts.isArray() || parts.isEmpty()) {
        throw new ChapterAnalysisException.ValidationException(
            "Vertex AI candidate content missing parts");
      }

      String rawText = parts.get(0).path("text").asText("");
      if (rawText.isBlank()) {
        throw new ChapterAnalysisException.ValidationException(
            "Vertex AI returned empty text candidate");
      }

      ChapterAnalysisUsage usage = extractUsageTelemetry(root.get("usageMetadata"), runtimeMs);
      return new GeneratedAnalysisResponse(rawText, usage);
    } catch (RuntimeException e) {
      throw new ChapterAnalysisException.ValidationException(
          "Failed to parse Vertex AI response body: " + e.getMessage(), e);
    }
  }

  private static ChapterAnalysisUsage extractUsageTelemetry(
      JsonNode usageMetadata, long runtimeMs) {
    if (usageMetadata == null) {
      return new ChapterAnalysisUsage(null, null, null, null, null, runtimeMs);
    }
    Long promptTokens = nullableLong(usageMetadata, "promptTokenCount");
    Long outputTokens = nullableLong(usageMetadata, "candidatesTokenCount");
    Long thinkingTokens = nullableLong(usageMetadata, "thoughtsTokenCount");
    if (thinkingTokens == null) thinkingTokens = nullableLong(usageMetadata, "thinkingTokenCount");
    Long cachedTokens = nullableLong(usageMetadata, "cachedContentTokenCount");
    Long totalTokens = nullableLong(usageMetadata, "totalTokenCount");

    return new ChapterAnalysisUsage(
        promptTokens, outputTokens, thinkingTokens, cachedTokens, totalTokens, runtimeMs);
  }

  private static Long nullableLong(JsonNode node, String field) {
    JsonNode value = node.get(field);
    return value == null || !value.isIntegralNumber() ? null : value.asLong();
  }

  private HttpResponse<String> sendHttpRequest(String url, String jsonBody)
      throws IOException, InterruptedException {
    HttpRequest.Builder builder =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .timeout(properties.getTimeout())
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(jsonBody));

    String token = resolveBearerToken();
    if (token != null && !token.isBlank()) {
      builder.header("Authorization", "Bearer " + token);
    }

    if (properties.getApiKey() != null && !properties.getApiKey().isBlank()) {
      builder.header("x-goog-api-key", properties.getApiKey());
    }

    return httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
  }

  private String resolveBearerToken() {
    if (properties.getBearerToken() != null && !properties.getBearerToken().isBlank()) {
      return properties.getBearerToken();
    }
    try {
      if (credentials == null) {
        credentials = GoogleCredentials.getApplicationDefault();
        if (credentials.createScopedRequired()) {
          credentials =
              credentials.createScoped(java.util.Collections.singletonList(CLOUD_PLATFORM_SCOPE));
        }
      }
      credentials.refreshIfExpired();
      var accessToken = credentials.getAccessToken();
      return accessToken != null ? accessToken.getTokenValue() : null;
    } catch (IOException e) {
      log.debug("No Google ADC credentials available: {}", e.getMessage());
      return null;
    }
  }

  private String buildEndpointUrl(String action) {
    String host =
        "global".equalsIgnoreCase(properties.getLocation())
            ? "https://aiplatform.googleapis.com"
            : "https://" + properties.getLocation() + "-aiplatform.googleapis.com";

    return String.format(
        "%s/v1/projects/%s/locations/%s/publishers/google/models/%s:%s",
        host, properties.getProjectId(), properties.getLocation(), properties.getModel(), action);
  }

  private static ChapterAnalysisException mapHttpError(int statusCode, String errorBody) {
    log.warn("Vertex AI returned error HTTP {}: {}", statusCode, errorBody);
    if (statusCode == 429) {
      return new ChapterAnalysisException.RateLimitException(
          "Vertex AI rate limit exceeded (HTTP 429): " + errorBody);
    }
    if (statusCode == 503 || statusCode == 504 || statusCode == 500) {
      return new ChapterAnalysisException.ProviderUnavailableException(
          "Vertex AI service unavailable (HTTP " + statusCode + "): " + errorBody);
    }
    return new ChapterAnalysisException.ValidationException(
        "Vertex AI returned HTTP " + statusCode + ": " + errorBody);
  }

  public record GeneratedAnalysisResponse(String rawJson, ChapterAnalysisUsage usage) {}

  public String promptHash() {
    return contractResources.promptHash();
  }

  public String schemaHash() {
    return contractResources.schemaHash();
  }
}
