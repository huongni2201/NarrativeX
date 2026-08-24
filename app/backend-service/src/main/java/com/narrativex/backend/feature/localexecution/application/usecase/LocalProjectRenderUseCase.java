package com.narrativex.backend.feature.localexecution.application.usecase;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.localexecution.application.port.in.LocalDeviceAccess;
import com.narrativex.backend.feature.localexecution.application.port.out.LocalProjectRenderStore;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class LocalProjectRenderUseCase {
  public static final String CAPABILITY = "PROJECT_RENDER";
  private static final int LEASE_SECONDS = 90;

  private final LocalDeviceAccess localDeviceAccess;
  private final LocalProjectRenderStore store;

  public Optional<LocalProjectRenderStore.ClaimedProjectRender> claim(String deviceToken) {
    var device = localDeviceAccess.authenticate(deviceToken, CAPABILITY);
    UUID leaseToken = UuidV7.random();
    return store.claimNext(device.id(), workerId(device.id()), leaseToken, LEASE_SECONDS);
  }

  public void heartbeat(String deviceToken, UUID jobId, UUID leaseToken) {
    var device = localDeviceAccess.authenticate(deviceToken, CAPABILITY);
    if (!store.heartbeat(jobId, device.id(), workerId(device.id()), leaseToken)) {
      throw leaseLost();
    }
  }

  public void updateProgress(
      String deviceToken, UUID jobId, UUID leaseToken, int progress, String currentStep) {
    if (progress < 5 || progress >= 100) {
      throw new IllegalArgumentException("Project render progress must be between 5 and 99");
    }
    String step = currentStep == null ? "" : currentStep.trim();
    if (step.isEmpty() || step.length() > 80) {
      throw new IllegalArgumentException("currentStep must contain 1 to 80 characters");
    }
    var device = localDeviceAccess.authenticate(deviceToken, CAPABILITY);
    if (!store.updateProgress(
        jobId, device.id(), workerId(device.id()), leaseToken, progress, step)) {
      throw leaseLost();
    }
  }

  public void complete(
      String deviceToken,
      UUID jobId,
      UUID leaseToken,
      LocalProjectRenderStore.CompletionResult result) {
    var device = localDeviceAccess.authenticate(deviceToken, CAPABILITY);
    store.complete(jobId, device.id(), workerId(device.id()), leaseToken, result);
  }

  public void cancel(String deviceToken, UUID jobId, UUID leaseToken) {
    var device = localDeviceAccess.authenticate(deviceToken, CAPABILITY);
    if (!store.cancel(jobId, device.id(), workerId(device.id()), leaseToken)) {
      throw leaseLost();
    }
  }

  public void fail(
      String deviceToken,
      UUID jobId,
      UUID leaseToken,
      String errorCode,
      boolean retryable) {
    String normalizedErrorCode =
        errorCode == null || errorCode.isBlank() ? "DESKTOP_RENDER_FAILED" : errorCode.trim();
    if (normalizedErrorCode.length() > 80) {
      normalizedErrorCode = normalizedErrorCode.substring(0, 80);
    }
    var device = localDeviceAccess.authenticate(deviceToken, CAPABILITY);
    if (!store.fail(
        jobId,
        device.id(),
        workerId(device.id()),
        leaseToken,
        normalizedErrorCode,
        retryable)) {
      throw leaseLost();
    }
  }

  private static IllegalStateException leaseLost() {
    return new IllegalStateException("Desktop project render lease is no longer owned by this device");
  }

  private static String workerId(UUID deviceId) {
    return "desktop:" + deviceId;
  }
}
