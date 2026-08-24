package com.narrativex.backend.feature.localexecution.application.usecase;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.localexecution.application.port.in.LocalDeviceAccess;
import com.narrativex.backend.feature.localexecution.application.port.out.LocalProjectRenderStore;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class LocalProjectRenderUseCaseTest {
  private final LocalDeviceAccess localDeviceAccess = mock(LocalDeviceAccess.class);
  private final LocalProjectRenderStore store = mock(LocalProjectRenderStore.class);
  private final LocalProjectRenderUseCase useCase =
      new LocalProjectRenderUseCase(localDeviceAccess, store);

  @Test
  void claimRequiresProjectRenderCapabilityAndUsesDeviceScopedWorkerLease() {
    UUID deviceId = UUID.randomUUID();
    when(localDeviceAccess.authenticate("device-token", LocalProjectRenderUseCase.CAPABILITY))
        .thenReturn(new LocalDeviceAccess.AuthenticatedDevice(deviceId, "user-1"));
    when(store.claimNext(eq(deviceId), eq("desktop:" + deviceId), any(UUID.class), eq(90)))
        .thenReturn(Optional.empty());

    useCase.claim("device-token");

    verify(localDeviceAccess).authenticate("device-token", LocalProjectRenderUseCase.CAPABILITY);
    verify(store).claimNext(eq(deviceId), eq("desktop:" + deviceId), any(UUID.class), eq(90));
  }

  @Test
  void rejectsProgressWhenLeaseIsNoLongerOwnedByDevice() {
    UUID deviceId = UUID.randomUUID();
    UUID jobId = UUID.randomUUID();
    UUID leaseToken = UUID.randomUUID();
    when(localDeviceAccess.authenticate("device-token", LocalProjectRenderUseCase.CAPABILITY))
        .thenReturn(new LocalDeviceAccess.AuthenticatedDevice(deviceId, "user-1"));
    when(store.updateProgress(
            jobId, deviceId, "desktop:" + deviceId, leaseToken, 40, "RENDERING"))
        .thenReturn(false);

    assertThatThrownBy(
            () ->
                useCase.updateProgress(
                    "device-token", jobId, leaseToken, 40, "RENDERING"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("lease is no longer owned");
  }

  @Test
  void completeAuthenticatesDeviceAndDelegatesImmutableLocalArtifactResult() {
    UUID deviceId = UUID.randomUUID();
    UUID jobId = UUID.randomUUID();
    UUID leaseToken = UUID.randomUUID();
    LocalProjectRenderStore.CompletionResult result =
        new LocalProjectRenderStore.CompletionResult(
            "a".repeat(64),
            "artifacts/" + jobId + "/final.mp4",
            "LOCAL_DESKTOP",
            null,
            null,
            "video/mp4",
            1024L,
            "b".repeat(64),
            60_000L,
            1920,
            1080,
            30);
    when(localDeviceAccess.authenticate("device-token", LocalProjectRenderUseCase.CAPABILITY))
        .thenReturn(new LocalDeviceAccess.AuthenticatedDevice(deviceId, "user-1"));

    useCase.complete("device-token", jobId, leaseToken, result);

    verify(store).complete(jobId, deviceId, "desktop:" + deviceId, leaseToken, result);
  }

  @Test
  void cancelUsesOwnedLeaseAndRejectsAStaleDesktopClaim() {
    UUID deviceId = UUID.randomUUID();
    UUID jobId = UUID.randomUUID();
    UUID leaseToken = UUID.randomUUID();
    when(localDeviceAccess.authenticate("device-token", LocalProjectRenderUseCase.CAPABILITY))
        .thenReturn(new LocalDeviceAccess.AuthenticatedDevice(deviceId, "user-1"));
    when(store.cancel(jobId, deviceId, "desktop:" + deviceId, leaseToken)).thenReturn(false);

    assertThatThrownBy(() -> useCase.cancel("device-token", jobId, leaseToken))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("lease is no longer owned");

    verify(store).cancel(jobId, deviceId, "desktop:" + deviceId, leaseToken);
  }
}
