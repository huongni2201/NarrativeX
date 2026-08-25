package com.narrativex.backend.feature.auth.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.out.DesktopGuestInstallationRepository;
import com.narrativex.backend.feature.auth.application.port.out.GuestOwnershipTransferPort;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.BadCredentialsException;

class DesktopGuestIdentityServiceTest {
  private static final String DEVICE_ID = "00000000-0000-4000-8000-000000000001";
  private static final String SECRET = "s".repeat(43);

  @Test
  void resumesTheSameGuestForTheSameInstallationSecret() throws Exception {
    DesktopGuestInstallationRepository installations = mock(DesktopGuestInstallationRepository.class);
    GuestOwnershipTransferPort ownership = mock(GuestOwnershipTransferPort.class);
    when(installations.findByDeviceId(DEVICE_ID))
        .thenReturn(
            Optional.of(
                new DesktopGuestInstallationRepository.Installation(
                    DEVICE_ID, "guest-stable", sha256(SECRET))));
    DesktopGuestIdentityService service = new DesktopGuestIdentityService(installations, ownership);

    assertEquals("guest-stable", service.establish(DEVICE_ID, SECRET));

    verify(installations).lockDevice(DEVICE_ID);
    verify(installations).touch(anyString(), any());
    verify(installations, never()).create(anyString(), anyString(), anyString(), any());
  }

  @Test
  void rejectsASecretThatDoesNotBelongToTheInstallation() throws Exception {
    DesktopGuestInstallationRepository installations = mock(DesktopGuestInstallationRepository.class);
    GuestOwnershipTransferPort ownership = mock(GuestOwnershipTransferPort.class);
    when(installations.findByDeviceId(DEVICE_ID))
        .thenReturn(
            Optional.of(
                new DesktopGuestInstallationRepository.Installation(
                    DEVICE_ID, "guest-stable", sha256("x".repeat(43)))));
    DesktopGuestIdentityService service = new DesktopGuestIdentityService(installations, ownership);

    assertThrows(BadCredentialsException.class, () -> service.establish(DEVICE_ID, SECRET));

    verify(installations, never()).touch(anyString(), any());
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
