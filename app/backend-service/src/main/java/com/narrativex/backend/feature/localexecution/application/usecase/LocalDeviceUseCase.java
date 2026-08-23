package com.narrativex.backend.feature.localexecution.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.localexecution.application.port.out.LocalDeviceStore;
import com.narrativex.backend.feature.localexecution.application.query.LocalDeviceView;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class LocalDeviceUseCase {
  private static final Duration PAIRING_TTL = Duration.ofMinutes(10);
  private static final Duration ONLINE_WINDOW = Duration.ofSeconds(45);
  private static final SecureRandom RANDOM = new SecureRandom();
  private static final char[] PAIRING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();

  private final CurrentUserId currentUserId;
  private final LocalDeviceStore store;

  @Transactional
  public PairingCode createPairingCode() {
    Instant now = Instant.now();
    String code = generatePairingCode();
    Instant expiresAt = now.plus(PAIRING_TTL);
    store.createPairingCode(currentUserId.get(), sha256(code), expiresAt);
    return new PairingCode(code, expiresAt);
  }

  @Transactional
  public PairedDevice pair(PairDeviceCommand command) {
    validatePairCommand(command);
    Instant now = Instant.now();
    var pairing =
        store
            .consumePairingCode(sha256(normalizePairingCode(command.pairingCode())), now)
            .orElseThrow(() -> new BadCredentialsException("Pairing code is invalid or expired"));

    UUID deviceId = UUID.randomUUID();
    String deviceToken = generateDeviceToken();
    List<String> capabilities = normalizeCapabilities(command.capabilities());
    store.createDevice(
        deviceId,
        pairing.userId(),
        command.name().trim(),
        command.platform().trim(),
        command.agentVersion().trim(),
        sha256(deviceToken),
        now,
        capabilities);
    return new PairedDevice(deviceId, deviceToken);
  }

  @Transactional
  public void heartbeat(String deviceToken, HeartbeatCommand command) {
    if (deviceToken == null || deviceToken.isBlank()) {
      throw new BadCredentialsException("Device token is required");
    }
    var device =
        store
            .findByTokenHash(sha256(deviceToken.trim()))
            .filter(row -> row.revokedAt() == null)
            .orElseThrow(() -> new BadCredentialsException("Device token is invalid"));
    String agentVersion =
        command.agentVersion() == null || command.agentVersion().isBlank()
            ? "unknown"
            : command.agentVersion().trim();
    store.heartbeat(device.id(), agentVersion, Instant.now(), normalizeCapabilities(command.capabilities()));
  }

  @Transactional(readOnly = true)
  public List<LocalDeviceView> list() {
    return store.listByUser(currentUserId.get(), Instant.now().minus(ONLINE_WINDOW));
  }

  private static void validatePairCommand(PairDeviceCommand command) {
    if (command == null) throw new IllegalArgumentException("Pair request is required");
    if (command.pairingCode() == null || command.pairingCode().isBlank())
      throw new IllegalArgumentException("pairingCode is required");
    if (command.name() == null || command.name().isBlank())
      throw new IllegalArgumentException("name is required");
    if (command.platform() == null || command.platform().isBlank())
      throw new IllegalArgumentException("platform is required");
    if (command.agentVersion() == null || command.agentVersion().isBlank())
      throw new IllegalArgumentException("agentVersion is required");
  }

  private static String generatePairingCode() {
    StringBuilder value = new StringBuilder("NX-");
    for (int i = 0; i < 8; i++) {
      if (i == 4) value.append('-');
      value.append(PAIRING_ALPHABET[RANDOM.nextInt(PAIRING_ALPHABET.length)]);
    }
    return value.toString();
  }

  private static String normalizePairingCode(String code) {
    return code.trim().toUpperCase(Locale.ROOT);
  }

  private static String generateDeviceToken() {
    byte[] bytes = new byte[32];
    RANDOM.nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  private static List<String> normalizeCapabilities(List<String> capabilities) {
    if (capabilities == null) return List.of();
    return capabilities.stream()
        .filter(value -> value != null && !value.isBlank())
        .map(value -> value.trim().toUpperCase(Locale.ROOT))
        .distinct()
        .sorted()
        .toList();
  }

  private static String sha256(String value) {
    try {
      byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
      return java.util.HexFormat.of().formatHex(digest);
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is unavailable", exception);
    }
  }

  public record PairingCode(String code, Instant expiresAt) {}

  public record PairDeviceCommand(
      String pairingCode,
      String name,
      String platform,
      String agentVersion,
      List<String> capabilities) {}

  public record HeartbeatCommand(String agentVersion, List<String> capabilities) {}

  public record PairedDevice(UUID deviceId, String deviceToken) {}
}
