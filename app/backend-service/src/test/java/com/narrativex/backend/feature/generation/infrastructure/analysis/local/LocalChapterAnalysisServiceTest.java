package com.narrativex.backend.feature.generation.infrastructure.analysis.local;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.model.analysis.*;
import com.narrativex.backend.feature.generation.application.port.out.*;
import com.narrativex.backend.feature.generation.application.service.GenerationJobTransactionService;
import com.narrativex.backend.feature.generation.domain.enums.*;
import com.narrativex.backend.feature.generation.infrastructure.dispatch.ChapterAnalysisJobHandler;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ChapterAnalysisExecutionMapper;
import com.narrativex.backend.feature.localexecution.application.port.in.LocalDeviceAccess;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class LocalChapterAnalysisServiceTest {
  private final ChapterAnalysisExecutionStore store = mock(ChapterAnalysisExecutionStore.class);
  private final ChapterAnalysisExecutionMapper mapper = mock(ChapterAnalysisExecutionMapper.class);
  private final GenerationJobRepository jobs = mock(GenerationJobRepository.class);
  private final GenerationJobTransactionService transactions =
      mock(GenerationJobTransactionService.class);
  private final LocalDeviceAccess devices = mock(LocalDeviceAccess.class);
  private final ChapterAnalysisJobHandler handler = mock(ChapterAnalysisJobHandler.class);
  private final LocalChapterAnalysisService service =
      new LocalChapterAnalysisService(store, mapper, jobs, transactions, devices, handler);
  private final UUID device = UUID.randomUUID();

  @Test
  void unknownAttemptRetainsGlobalSlotAndPreventsAnotherClaim() {
    when(devices.authenticate("device", "DESKTOP_APP"))
        .thenReturn(new LocalDeviceAccess.AuthenticatedDevice(device));
    when(store.findRuntimeConfiguration()).thenReturn(configuration(1));
    when(mapper.countHeldLocalSlots()).thenReturn(1);
    assertNull(service.claim("device", UUID.randomUUID(), UUID.randomUUID(), "adapter/1"));
    verify(mapper, never()).findNextQueuedLocalJob();
    verifyNoInteractions(transactions);
  }

  @Test
  void agySessionUsesConfiguredParallelCapacity() {
    var credential = credential(device, "CONNECTED", "AVAILABLE", null, null);
    authenticate();
    when(store.findRuntimeConfiguration()).thenReturn(configuration(3));
    when(store.findCredential(credential.credentialRef())).thenReturn(Optional.of(credential));
    when(mapper.countHeldLocalSlots()).thenReturn(3);
    assertNull(service.claim("device", UUID.randomUUID(), credential.credentialRef(), "adapter/1"));
    verify(mapper, never()).findNextQueuedLocalJob();
  }

  @Test
  void authRequiredAndRateLimitedSessionDoesNotReceiveWork() {
    authenticate();
    when(store.findRuntimeConfiguration()).thenReturn(configuration(4));
    var expired = credential(device, "AUTH_REQUIRED", "AVAILABLE", null, null);
    var limited =
        credential(device, "CONNECTED", "RATE_LIMITED", Instant.now().plusSeconds(300), null);
    for (var c : List.of(expired, limited)) {
      when(store.findCredential(c.credentialRef())).thenReturn(Optional.of(c));
      assertNull(service.claim("device", UUID.randomUUID(), c.credentialRef(), "adapter/1"));
    }
    verify(mapper, never()).findNextQueuedLocalJob();
  }

  @Test
  void aRateLimitedAccountBecomesEligibleAgainAfterItsHoldOff() {
    var c =
        credential(device, "CONNECTED", "RATE_LIMITED", Instant.now().minusSeconds(5), null);
    assertTrue(c.eligibleAt(Instant.now()));
    assertFalse(
        credential(device, "CONNECTED", "EXHAUSTED", null, null).eligibleAt(Instant.now()));
  }

  @Test
  void anotherDevicesCredentialCannotBeUsedToClaim() {
    var foreign = credential(UUID.randomUUID(), "CONNECTED", "AVAILABLE", null, null);
    authenticate();
    when(store.findRuntimeConfiguration()).thenReturn(configuration(4));
    when(store.findCredential(foreign.credentialRef())).thenReturn(Optional.of(foreign));
    assertThrows(
        ResourceNotFoundException.class,
        () -> service.claim("device", UUID.randomUUID(), foreign.credentialRef(), "adapter/1"));
  }

  @Test
  void registeringTheSameAgySessionTwiceReusesOneCredential() {
    authenticate();
    var existing = credential(device, "CONNECTED", "AVAILABLE", null, "f".repeat(64));
    when(store.findCredentialByDevice(device)).thenReturn(Optional.of(existing));
    when(store.updateCredential(any(), eq(existing.rowVersion())))
        .thenReturn(Optional.of(existing));
    var result =
        service.registerCredential(
            "device", "f".repeat(64), "agy session", "adapter/1", List.of());
    assertEquals(existing.credentialRef(), result.credentialRef());
    verify(store, never()).insertCredential(any());
  }

  @Test
  void lostClaimAckCannotGrantExecutionTwice() {
    UUID request = UUID.randomUUID();
    when(devices.authenticate("device", "DESKTOP_APP"))
        .thenReturn(new LocalDeviceAccess.AuthenticatedDevice(device));
    when(store.findAttemptByClaimRequest(device, request))
        .thenReturn(Optional.of(attempt(ChapterAnalysisAttemptCheckpoint.SUBMITTING, null)));
    assertNull(service.claim("device", request, UUID.randomUUID(), "adapter/1"));
    verify(mapper, never()).findNextQueuedLocalJob();
  }

  @Test
  void resultCannotBeDeliveredByAnotherDevice() {
    var a = attempt(ChapterAnalysisAttemptCheckpoint.SUBMITTING, null);
    when(store.findAttempt(a.attemptId())).thenReturn(Optional.of(a));
    when(devices.authenticate("other", "DESKTOP_APP"))
        .thenReturn(new LocalDeviceAccess.AuthenticatedDevice(UUID.randomUUID()));
    assertThrows(
        RuntimeException.class, () -> service.complete("other", a.attemptId(), completion()));
    verifyNoInteractions(handler);
  }

  @Test
  void resultCannotBeDeliveredWithAnotherLease() {
    var a = attempt(ChapterAnalysisAttemptCheckpoint.SUBMITTING, null);
    when(store.findAttempt(a.attemptId())).thenReturn(Optional.of(a));
    when(devices.authenticate("device", "DESKTOP_APP"))
        .thenReturn(new LocalDeviceAccess.AuthenticatedDevice(device));
    assertThrows(
        RuntimeException.class,
        () -> service.report("device", a.attemptId(), "wrong", "AUTH_REQUIRED", false));
    verifyNoInteractions(transactions);
  }

  @Test
  void identicalCompletionReplayIsAcknowledgedWithoutRematerializing() {
    var completion = completion();
    var a =
        attempt(
            ChapterAnalysisAttemptCheckpoint.DELIVERED,
            CanonHashCalculator.sha256(completion.toString()));
    when(store.findAttempt(a.attemptId())).thenReturn(Optional.of(a));
    when(devices.authenticate("device", "DESKTOP_APP"))
        .thenReturn(new LocalDeviceAccess.AuthenticatedDevice(device));
    service.complete("device", a.attemptId(), completion);
    verifyNoInteractions(handler);
  }

  @Test
  void changedCompletionReplayIsRejected() {
    var a = attempt(ChapterAnalysisAttemptCheckpoint.DELIVERED, "f".repeat(64));
    when(store.findAttempt(a.attemptId())).thenReturn(Optional.of(a));
    when(devices.authenticate("device", "DESKTOP_APP"))
        .thenReturn(new LocalDeviceAccess.AuthenticatedDevice(device));
    assertThrows(
        RuntimeException.class, () -> service.complete("device", a.attemptId(), completion()));
    verifyNoInteractions(handler);
  }

  private void authenticate() {
    when(devices.authenticate("device", "DESKTOP_APP"))
        .thenReturn(new LocalDeviceAccess.AuthenticatedDevice(device));
  }

  private AnalysisRuntimeConfiguration configuration(int maxConcurrent) {
    return new AnalysisRuntimeConfiguration(
        1,
        ChapterAnalysisExecutionMode.ANTIGRAVITY_CLI,
        "model-x",
        "HIGH",
        maxConcurrent,
        20,
        2_000_000,
        4_194_304,
        600_000,
        0);
  }

  private AnalysisProviderCredential credential(
      UUID owner,
      String connection,
      String quota,
      Instant nextEligible,
      String fingerprint) {
    return new AnalysisProviderCredential(
        UUID.randomUUID(),
        owner,
        fingerprint == null ? "f".repeat(64) : fingerprint,
        1,
        "agy session",
        connection,
        "adapter/1",
        List.of(),
        quota,
        null,
        nextEligible,
        null,
        0,
        0);
  }

  private LocalChapterAnalysisService.Completion completion() {
    return new LocalChapterAnalysisService.Completion(
        "lease",
        "{}",
        new ChapterAnalysisUsage(null, null, null, null, null, 1),
        "1.2.3",
        "conversation");
  }

  private ChapterAnalysisExecutionAttempt attempt(
      ChapterAnalysisAttemptCheckpoint checkpoint, String payloadHash) {
    return new ChapterAnalysisExecutionAttempt(
        UUID.randomUUID(),
        UUID.randomUUID(),
        1,
        UUID.randomUUID(),
        device,
        UUID.randomUUID(),
        1,
        "a".repeat(64),
        checkpoint,
        CanonHashCalculator.sha256("lease"),
        Instant.now().plusSeconds(60),
        1,
        0,
        UUID.randomUUID(),
        null,
        null,
        payloadHash,
        null,
        checkpoint != ChapterAnalysisAttemptCheckpoint.DELIVERED,
        0,
        null,
        null);
  }
}
