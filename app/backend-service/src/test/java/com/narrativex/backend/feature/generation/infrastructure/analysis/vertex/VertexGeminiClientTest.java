package com.narrativex.backend.feature.generation.infrastructure.analysis.vertex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisException;
import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

class VertexGeminiClientTest {

  private static final String COUNT_TOKENS_RESPONSE = "{\"totalTokens\": 1250}";
  private static final String VALID_GENERATE_RESPONSE =
      "{\n"
          + "  \"candidates\": [\n"
          + "    {\n"
          + "      \"content\": {\n"
          + "        \"parts\": [\n"
          + "          {\n"
          + "            \"text\": \"{\\\"scenes\\\":[]}\"\n"
          + "          }\n"
          + "        ]\n"
          + "      }\n"
          + "    }\n"
          + "  ],\n"
          + "  \"usageMetadata\": {\n"
          + "    \"promptTokenCount\": 1200,\n"
          + "    \"candidatesTokenCount\": 450,\n"
          + "    \"thoughtsTokenCount\": 300,\n"
          + "    \"cachedContentTokenCount\": 100,\n"
          + "    \"totalTokenCount\": 1650\n"
          + "  }\n"
          + "}";

  private VertexGeminiProperties properties;
  private HttpClient httpClient;
  private ObjectMapper objectMapper;
  private VertexGeminiClient client;

  @BeforeEach
  void setUp() {
    properties = new VertexGeminiProperties();
    properties.setEnabled(true);
    properties.setProjectId("test-project");
    properties.setLocation("us-central1");
    properties.setModel("gemini-3.8-flash");
    properties.setBearerToken("test-bearer-token");

    httpClient = mock(HttpClient.class);
    objectMapper = JsonMapper.builder().build();
    client = new VertexGeminiClient(properties, httpClient, objectMapper);
  }

  @Test
  void countTokensParsesTotalTokensSuccessfully() throws Exception {
    HttpResponse<String> response = mock(HttpResponse.class);
    when(response.statusCode()).thenReturn(200);
    when(response.body()).thenReturn(COUNT_TOKENS_RESPONSE);
    when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenReturn(response);

    int count = client.countTokens("Sample text for testing");
    assertEquals(1250, count);
  }

  @Test
  void countTokensHandles503AsProviderUnavailable() throws Exception {
    HttpResponse<String> response = mock(HttpResponse.class);
    when(response.statusCode()).thenReturn(503);
    when(response.body()).thenReturn("Service Unavailable");
    when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenReturn(response);

    assertThrows(
        ChapterAnalysisException.ProviderUnavailableException.class,
        () -> client.countTokens("Sample text"));
  }

  @Test
  void generateContentParsesCandidateAndUsageTelemetry() throws Exception {
    HttpResponse<String> response = mock(HttpResponse.class);
    when(response.statusCode()).thenReturn(200);
    when(response.body()).thenReturn(VALID_GENERATE_RESPONSE);
    when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenReturn(response);

    var result = client.generateContent("Source chapter text", "vi", "1.0", "1.0");
    assertNotNull(result);
    assertEquals("{\"scenes\":[]}", result.rawJson());
    assertEquals(1200, result.usage().promptTokens());
    assertEquals(450, result.usage().outputTokens());
    assertEquals(300, result.usage().thinkingTokens());
    assertEquals(100, result.usage().cachedTokens());
    assertEquals(1650, result.usage().totalTokens());
    assertTrue(result.usage().runtimeMs() >= 0);
  }

  @Test
  void generateContentMaps429ToRateLimitException() throws Exception {
    HttpResponse<String> response = mock(HttpResponse.class);
    when(response.statusCode()).thenReturn(429);
    when(response.body()).thenReturn("Resource Exhausted: Rate limit exceeded");
    when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenReturn(response);

    var exc =
        assertThrows(
            ChapterAnalysisException.RateLimitException.class,
            () -> client.generateContent("text", "vi", "1.0", "1.0"));
    assertTrue(exc.isRetryable());
  }

  @Test
  void generateContentMapsNoCandidatesToValidationException() throws Exception {
    HttpResponse<String> response = mock(HttpResponse.class);
    when(response.statusCode()).thenReturn(200);
    when(response.body()).thenReturn("{\"candidates\":[]}");
    when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenReturn(response);

    assertThrows(
        ChapterAnalysisException.ValidationException.class,
        () -> client.generateContent("text", "vi", "1.0", "1.0"));
  }
}
