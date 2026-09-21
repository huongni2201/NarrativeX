package com.narrativex.backend.feature.generation.api.internal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.generation.application.service.ComputeEventApplicationService;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

class ComputeEventControllerTest {

  private ComputeEventApplicationService eventApplicationService;
  private ObjectMapper objectMapper;
  private ComputeEventController controller;
  private static final String SECRET = "test-secret-key-123456";

  @BeforeEach
  void setUp() {
    eventApplicationService = mock(ComputeEventApplicationService.class);
    objectMapper = JsonMapper.builder().build();
    controller = new ComputeEventController(eventApplicationService, objectMapper, SECRET);
  }

  private String sign(String timestamp, String body) throws Exception {
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    String toSign = timestamp + "." + body;
    return HexFormat.of().formatHex(mac.doFinal(toSign.getBytes(StandardCharsets.UTF_8)));
  }

  @Test
  void acceptsValidEventWithCorrectSignature() throws Exception {
    UUID taskId = UUID.randomUUID();
    UUID attemptId = UUID.randomUUID();
    String body =
        """
        {
          "eventId": "evt_123",
          "protocolVersion": "1.0",
          "taskId": "%s",
          "attemptId": "%s",
          "sequence": 1,
          "state": "RUNNING",
          "progress": 0.5
        }
        """
            .formatted(taskId, attemptId);

    String timestamp = String.valueOf(System.currentTimeMillis());
    String signature = sign(timestamp, body);

    when(eventApplicationService.processEvent(any(ComputeEventRequest.class), any()))
        .thenReturn(ComputeEventApplicationService.ProcessingOutcome.PROCESSED);

    ResponseEntity<?> response = controller.handleComputeEvent(signature, timestamp, body);

    assertEquals(HttpStatus.OK, response.getStatusCode());
    @SuppressWarnings("unchecked")
    Map<String, Object> respMap = (Map<String, Object>) response.getBody();
    assertEquals("PROCESSED", respMap.get("status"));
    assertEquals("evt_123", respMap.get("eventId"));
  }

  @Test
  void rejectsEventWithMissingSignature() {
    String body = "{}";
    ResponseEntity<?> response = controller.handleComputeEvent(null, "12345", body);
    assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
  }

  @Test
  void rejectsEventWithInvalidSignature() {
    String timestamp = String.valueOf(System.currentTimeMillis());
    String body = "{\"eventId\":\"evt_1\"}";
    ResponseEntity<?> response = controller.handleComputeEvent("invalid-sig", timestamp, body);
    assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
  }

  @Test
  void rejectsEventWithExpiredTimestamp() throws Exception {
    String body = "{\"eventId\":\"evt_1\"}";
    long staleTime = System.currentTimeMillis() - (10 * 60 * 1000L); // 10 minutes ago
    String timestamp = String.valueOf(staleTime);
    String signature = sign(timestamp, body);

    ResponseEntity<?> response = controller.handleComputeEvent(signature, timestamp, body);
    assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
  }
}
