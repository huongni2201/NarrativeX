package com.narrativex.backend.feature.auth.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.exception.InvalidDesktopGuestCredentialException;
import com.narrativex.backend.feature.auth.application.port.out.DesktopGuestInstallationRepository;
import com.narrativex.backend.feature.auth.application.port.out.GuestOwnershipTransferPort;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DesktopGuestIdentityServiceTest {
  private static final String DEVICE_ID = "00000000-0000-4000-8000-000000000001";
  private static final UUID DEVICE_UUID = UUID.fromString(DEVICE_ID);
  private static final String SECRET = "s".repeat(43);

  @Test
  void resumesTheSameGuestForTheSameInstallationSecret() throws Exception {
    DesktopGuestInstallationRepository installations = mock(DesktopGuestInstallationRepository.class);
    GuestOwnershipTransferPort ownership = mock(GuestOwnershipTransferPort.class);
    when(installations.findByDeviceId(DEVICE_UUID))
        .thenReturn(
            Optional.of(
                new DesktopGuestInstallationRepository.Installation(
                    DEVICE_UUID, "guest-stable", sha256(SECRET))));
    DesktopGuestIdentityService service = new DesktopGuestIdentityService(installations, ownership);

    assertEquals("guest-stable", service.establish(DEVICE_ID, SECRET));

    verify(installations).lockDevice(DEVICE_UUID);
    verify(installations).touch(eq(DEVICE_UUID), any());
    verify(installations, never()).create(any(UUID.class), anyString(), anyString(), any());
  }

  @Test
  void rejectsASecretThatDoesNotBelongToTheInstallation() throws Exception {
    DesktopGuestInstallationRepository installations = mock(DesktopGuestInstallationRepository.class);
    GuestOwnershipTransferPort ownership = mock(GuestOwnershipTransferPort.class);
    when(installations.findByDeviceId(DEVICE_UUID))
        .thenReturn(
            Optional.of(
                new DesktopGuestInstallationRepository.Installation(
                    DEVICE_UUID, "guest-stable", sha256("x".repeat(43)))));
    DesktopGuestIdentityService service = new DesktopGuestIdentityService(installations, ownership);

    assertThrows(
        InvalidDesktopGuestCredentialException.class,
        () -> service.establish(DEVICE_ID, SECRET));

    verify(installations, never()).touch(any(UUID.class), any());
  }

  @Test
  void ownershipTransferIsDelegatedWithoutChangingEntityIds() {
    DesktopGuestInstallationRepository installations = mock(DesktopGuestInstallationRepository.class);
    GuestOwnershipTransferPort ownership = mock(GuestOwnershipTransferPort.class);
    DesktopGuestIdentityService service = new DesktopGuestIdentityService(installations, ownership);

    service.transferOwnership("guest-stable", "user-google");

    verify(ownership).transfer("guest-stable", "user-google");
  }

  private static String sha256(String value) throws Exception {
    return HexFormat.of()
        .formatHex(
            MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8)));
  }
}
