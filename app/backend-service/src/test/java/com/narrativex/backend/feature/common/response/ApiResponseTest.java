package com.narrativex.backend.feature.common.response;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import org.junit.jupiter.api.Test;

class ApiResponseTest {
  @Test
  void successEnvelopeContainsDataMessageAndTimestamp() {
    ApiResponse<String> response = ApiResponse.success("Created", "payload");
    assertTrue(response.success());
    assertEquals("Created", response.message());
    assertEquals("payload", response.data());
    assertTrue(response.timestamp().isBefore(Instant.now().plusSeconds(1)));
  }
}
