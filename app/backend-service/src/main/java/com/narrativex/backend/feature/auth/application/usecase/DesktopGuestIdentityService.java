package com.narrativex.backend.feature.auth.application.usecase;

import com.narrativex.backend.feature.auth.application.exception.InvalidDesktopGuestCredentialException;
import com.narrativex.backend.feature.auth.application.port.in.DesktopGuestIdentity;
import com.narrativex.backend.feature.auth.application.port.out.DesktopGuestInstallationRepository;
import com.narrativex.backend.feature.auth.application.port.out.GuestOwnershipTransferPort;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DesktopGuestIdentityService implements DesktopGuestIdentity {
  private final DesktopGuestInstallationRepository installations;
  private final GuestOwnershipTransferPort ownershipTransfer;

  @Override
  @Transactional
  public String establish(String deviceId, String secret) {
    UUID stableDeviceId = UUID.fromString(deviceId);
    installations.lockDevice(stableDeviceId);
    String secretHash = sha256(secret);
    var existing = installations.findByDeviceId(stableDeviceId);
    if (existing.isPresent()) {
      verifySecret(existing.get().secretHash(), secretHash);
      installations.touch(stableDeviceId, Instant.now());
      return existing.get().guestUserId();
    }

    String guestUserId = "guest-" + UuidV7.random();
    Instant now = Instant.now();
    if (!installations.create(stableDeviceId, guestUserId, secretHash, now)) {
      throw new IllegalStateException("Desktop guest installation was not persisted.");
    }
    installations.touch(stableDeviceId, now);
    return guestUserId;
  }

  @Override
  @Transactional
  public void transferOwnership(String sourceGuestUserId, String targetUserId) {
    if (sourceGuestUserId == null
        || sourceGuestUserId.isBlank()
        || targetUserId == null
        || targetUserId.isBlank()
        || sourceGuestUserId.equals(targetUserId)) {
      return;
    }
    ownershipTransfer.transfer(sourceGuestUserId, targetUserId);
  }

  private static void verifySecret(String expectedHash, String actualHash) {
    if (!MessageDigest.isEqual(
        expectedHash.getBytes(StandardCharsets.US_ASCII),
        actualHash.getBytes(StandardCharsets.US_ASCII))) {
      throw new InvalidDesktopGuestCredentialException();
    }
  }

  private static String sha256(String value) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256")
                  .digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is unavailable.", exception);
    }
  }
}
