package com.narrativex.backend.feature.localexecution.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.localexecution.application.query.LocalDeviceView;
import com.narrativex.backend.feature.localexecution.application.usecase.LocalDeviceUseCase;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/local-devices")
public class LocalDeviceController {
  private static final String DEVICE_TOKEN_HEADER = "X-NX-Device-Token";

  private final LocalDeviceUseCase localDeviceUseCase;

  @PostMapping("/pairing-codes")
  public ResponseEntity<ApiResponse<PairingCodeResponse>> createPairingCode() {
    var pairing = localDeviceUseCase.createPairingCode();
    return ResponseEntity.ok(
        ApiResponse.success(
            "Pairing code created",
            new PairingCodeResponse(pairing.code(), pairing.expiresAt())));
  }

  @GetMapping
  public ResponseEntity<ApiResponse<List<LocalDeviceResponse>>> list() {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Local devices retrieved",
            localDeviceUseCase.list().stream().map(LocalDeviceResponse::from).toList()));
  }

  @PostMapping("/pair")
  public ResponseEntity<ApiResponse<PairDeviceResponse>> pair(
      @Valid @RequestBody PairDeviceRequest request) {
    var paired =
        localDeviceUseCase.pair(
            new LocalDeviceUseCase.PairDeviceCommand(
                request.pairingCode(),
                request.name(),
                request.platform(),
                request.agentVersion(),
                request.capabilities()));
    return ResponseEntity.ok(
        ApiResponse.success(
            "Device paired successfully",
            new PairDeviceResponse(paired.deviceId(), paired.deviceToken())));
  }

  @PostMapping("/heartbeat")
  public ResponseEntity<ApiResponse<Void>> heartbeat(
      @RequestHeader(DEVICE_TOKEN_HEADER) String deviceToken,
      @Valid @RequestBody HeartbeatRequest request) {
    localDeviceUseCase.heartbeat(
        deviceToken,
        new LocalDeviceUseCase.HeartbeatCommand(request.agentVersion(), request.capabilities()));
    return ResponseEntity.ok(ApiResponse.success("Heartbeat accepted"));
  }

  public record PairDeviceRequest(
      @NotBlank @Size(max = 128) String pairingCode,
      @NotBlank @Size(max = 160) String name,
      @NotBlank @Size(max = 80) String platform,
      @NotBlank @Size(max = 64) String agentVersion,
      @Size(max = 64) List<@NotBlank @Size(max = 64) String> capabilities) {}

  public record HeartbeatRequest(
      @NotBlank @Size(max = 64) String agentVersion,
      @Size(max = 64) List<@NotBlank @Size(max = 64) String> capabilities) {}

  public record PairingCodeResponse(String code, Instant expiresAt) {}

  public record PairDeviceResponse(UUID deviceId, String deviceToken) {}

  public record LocalDeviceResponse(
      UUID id,
      String name,
      String platform,
      String agentVersion,
      List<String> capabilities,
      Instant lastSeenAt,
      boolean online) {
    static LocalDeviceResponse from(LocalDeviceView view) {
      return new LocalDeviceResponse(
          view.id(),
          view.name(),
          view.platform(),
          view.agentVersion(),
          view.capabilities(),
          view.lastSeenAt(),
          view.online());
    }
  }
}
