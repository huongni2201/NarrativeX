package com.narrativex.backend.feature.generation.api.internal;

import com.narrativex.backend.feature.generation.application.service.ComputeEventApplicationService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.ObjectMapper;

@Slf4j
@RestController
@RequestMapping
public class ComputeEventController {
  private static final long MAX_ALLOWED_SKEW_MS = 5 * 60 * 1000L; // 5 minutes

  private final ComputeEventApplicationService eventApplicationService;
  private final ObjectMapper objectMapper;
  private final String callbackSecret;

  public ComputeEventController(
      ComputeEventApplicationService eventApplicationService,
      ObjectMapper objectMapper,
      @Value(
              "${narrativex.compute.callback-secret:${narrativex.compute.machine-token:default-dev-machine-token}}")
          String callbackSecret) {
    this.eventApplicationService = eventApplicationService;
    this.objectMapper = objectMapper;
    this.callbackSecret = callbackSecret;
  }

  @PostMapping(
      value = {"/internal/compute/events", "/internal/v1/compute-events"},
      consumes = {"application/json", "application/vnd.narrativex.compute-v1+json"})
  public ResponseEntity<?> handleComputeEvent(
      @RequestHeader(value = "X-NarrativeX-Compute-Signature", required = false) String signature,
      @RequestHeader(value = "X-NarrativeX-Compute-Timestamp", required = false)
          String timestampHeader,
      @RequestBody String rawBody) {

    // 1. Verify HMAC Signature if secret configured and header provided
    String secret = callbackSecret;
    if (secret != null && !secret.isBlank()) {
      if (signature == null || timestampHeader == null) {
        log.warn("Compute event rejected: Missing signature or timestamp header");
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(Map.of("error", "Missing authentication headers"));
      }

      long timestampMs;
      try {
        timestampMs = Long.parseLong(timestampHeader);
      } catch (NumberFormatException e) {
        try {
          timestampMs = Instant.parse(timestampHeader).toEpochMilli();
        } catch (Exception ex) {
          log.warn("Compute event rejected: Invalid timestamp format: {}", timestampHeader);
          return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(Map.of("error", "Invalid timestamp format"));
        }
      }

      long currentMs = System.currentTimeMillis();
      if (Math.abs(currentMs - timestampMs) > MAX_ALLOWED_SKEW_MS) {
        log.warn(
            "Compute event rejected: Timestamp out of allowed tolerance window (sent={}, now={})",
            timestampMs,
            currentMs);
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(Map.of("error", "Timestamp replay limit exceeded"));
      }

      if (!verifySignature(secret, timestampHeader, rawBody, signature)) {
        log.warn("Compute event rejected: Invalid HMAC-SHA256 signature");
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(Map.of("error", "Invalid HMAC signature"));
      }
    }

    // 2. Deserialize Request
    ComputeEventRequest request;
    try {
      request = objectMapper.readValue(rawBody, ComputeEventRequest.class);
    } catch (Exception e) {
      log.warn("Compute event rejected: Malformed JSON payload: {}", e.getMessage());
      return ResponseEntity.status(HttpStatus.BAD_REQUEST)
          .body(Map.of("error", "Malformed event payload"));
    }

    // 3. Compute Payload Hash
    String payloadHash = sha256(rawBody);

    // 4. Process Event Idempotently
    ComputeEventApplicationService.ProcessingOutcome outcome =
        eventApplicationService.processEvent(request, payloadHash);

    return ResponseEntity.ok(
        Map.of(
            "status", outcome.name(),
            "eventId", request.eventId(),
            "taskId", request.taskId().toString()));
  }

  private boolean verifySignature(
      String secret, String timestamp, String rawBody, String incomingSignature) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      String toSign = timestamp + "." + rawBody;
      byte[] hmacBytes = mac.doFinal(toSign.getBytes(StandardCharsets.UTF_8));
      String expectedSignature = HexFormat.of().formatHex(hmacBytes);
      return MessageDigest.isEqual(
          expectedSignature.getBytes(StandardCharsets.UTF_8),
          incomingSignature.trim().getBytes(StandardCharsets.UTF_8));
    } catch (Exception e) {
      log.error("Error verifying compute HMAC signature", e);
      return false;
    }
  }

  private String sha256(String text) {
    try {
      MessageDigest md = MessageDigest.getInstance("SHA-256");
      byte[] hash = md.digest(text.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(hash);
    } catch (Exception e) {
      return "";
    }
  }
}
