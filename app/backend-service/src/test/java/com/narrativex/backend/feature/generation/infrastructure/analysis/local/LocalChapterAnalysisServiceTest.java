package com.narrativex.backend.feature.generation.infrastructure.analysis.local;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.model.analysis.*;
import com.narrativex.backend.feature.generation.application.port.out.*;
import com.narrativex.backend.feature.generation.application.service.GenerationJobTransactionService;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.*;
import com.narrativex.backend.feature.generation.infrastructure.dispatch.ChapterAnalysisJobHandler;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ChapterAnalysisExecutionMapper;
import com.narrativex.backend.feature.localexecution.application.port.in.LocalDeviceAccess;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

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
    var c = credential(device, "CONNECTED", "RATE_LIMITED", Instant.now().minusSeconds(5), null);
    assertTrue(c.eligibleAt(Instant.now()));
    assertFalse(credential(device, "CONNECTED", "EXHAUSTED", null, null).eligibleAt(Instant.now()));
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
        service.registerCredential("device", "f".repeat(64), "agy session", "adapter/1", List.of());
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

  @Test
  void aDesktopRestartWithoutAResultFailsTheJobAndReleasesTheSlotSoItCanBeRerun() {
    authenticate();
    var held = attempt(ChapterAnalysisAttemptCheckpoint.LOCAL_RUNNING, null);
    var job = mock(GenerationJob.class);
    when(job.getJobId()).thenReturn(UUID.randomUUID());
    when(store.findAttemptByClaimRequest(device, held.claimRequestId()))
        .thenReturn(Optional.of(held));
    when(jobs.findById(held.generationJobId())).thenReturn(Optional.of(job));
    when(store.updateAttempt(any(), anyLong(), anyLong())).thenReturn(true);

    service.recoverClaim("device", held.claimRequestId());

    verify(transactions)
        .markSubmissionFailed(eq(job.getJobId()), eq("APP_INTERRUPTED"), anyString());
    verify(transactions, never()).markSubmissionUnknown(any(), any(), any(), any());
    var saved = ArgumentCaptor.forClass(ChapterAnalysisExecutionAttempt.class);
    verify(store).updateAttempt(saved.capture(), anyLong(), anyLong());
    assertEquals(ChapterAnalysisAttemptCheckpoint.FAILED, saved.getValue().checkpoint());
    assertFalse(saved.getValue().slotHeld());
  }

  @Test
  void anUnknownAttemptThatNoResultReachedIsReleasedAsAFailureAfterTheGracePeriod() {
    var stale = attempt(ChapterAnalysisAttemptCheckpoint.UNKNOWN, null);
    var job = mock(GenerationJob.class);
    when(job.getJobId()).thenReturn(UUID.randomUUID());
    when(mapper.findExpiredLocalAttempts(any())).thenReturn(List.of());
    when(mapper.findStaleUnknownLocalAttempts(any())).thenReturn(List.of(stale.attemptId()));
    when(store.findAttempt(stale.attemptId())).thenReturn(Optional.of(stale));
    when(jobs.findById(stale.generationJobId())).thenReturn(Optional.of(job));
    when(store.updateAttempt(any(), anyLong(), anyLong())).thenReturn(true);

    service.expireObservations();

    verify(transactions)
        .markSubmissionFailed(eq(job.getJobId()), eq("OUTCOME_UNRESOLVED"), anyString());
    var saved = ArgumentCaptor.forClass(ChapterAnalysisExecutionAttempt.class);
    verify(store).updateAttempt(saved.capture(), anyLong(), anyLong());
    assertFalse(saved.getValue().slotHeld());
  }

  @Test
  void aTransientFailureReturnsTheChapterToTheQueueAndReleasesTheSlot() {
    authenticate();
    var running = attempt(ChapterAnalysisAttemptCheckpoint.LOCAL_RUNNING, null);
    var job = runningJob(running);
    when(store.findAttempt(running.attemptId())).thenReturn(Optional.of(running));
    when(store.updateAttempt(any(), anyLong(), anyLong())).thenReturn(true);

    service.report("device", running.attemptId(), "lease", "RATE_LIMITED", false);

    verify(transactions).markRequeued(job.getJobId(), "RATE_LIMITED");
    verify(transactions, never()).markSubmissionFailed(any(), any(), any());
    var saved = ArgumentCaptor.forClass(ChapterAnalysisExecutionAttempt.class);
    verify(store).updateAttempt(saved.capture(), anyLong(), anyLong());
    assertFalse(saved.getValue().slotHeld());
    assertEquals(ChapterAnalysisAttemptCheckpoint.FAILED, saved.getValue().checkpoint());
  }

  @Test
  void aTransientFailureBecomesFinalAfterTheAttemptLimit() {
    authenticate();
    var last =
        attempt(
            ChapterAnalysisAttemptCheckpoint.LOCAL_RUNNING, null, 5, Instant.now().plusSeconds(60));
    var job = runningJob(last);
    when(store.findAttempt(last.attemptId())).thenReturn(Optional.of(last));
    when(store.updateAttempt(any(), anyLong(), anyLong())).thenReturn(true);

    service.report("device", last.attemptId(), "lease", "QUOTA_EXHAUSTED", false);

    verify(transactions)
        .markSubmissionFailed(eq(job.getJobId()), eq("QUOTA_EXHAUSTED"), anyString());
    verify(transactions, never()).markRequeued(any(), any());
  }

  @Test
  void aFailureAboutTheChapterItselfIsNeverRequeued() {
    authenticate();
    var running = attempt(ChapterAnalysisAttemptCheckpoint.LOCAL_RUNNING, null);
    var job = runningJob(running);
    when(store.findAttempt(running.attemptId())).thenReturn(Optional.of(running));
    when(store.updateAttempt(any(), anyLong(), anyLong())).thenReturn(true);

    for (String code : List.of("SCHEMA_INVALID", "ANALYSIS_TIMEOUT", "CONTENT_BLOCKED")) {
      service.report("device", running.attemptId(), "lease", code, false);
    }

    verify(transactions, never()).markRequeued(any(), any());
    verify(transactions, times(3))
        .markSubmissionFailed(eq(job.getJobId()), anyString(), anyString());
  }

  @Test
  void theCancellationPollRenewsALeaseThatIsAboutToExpire() {
    authenticate();
    var nearExpiry =
        attempt(
            ChapterAnalysisAttemptCheckpoint.LOCAL_RUNNING, null, 1, Instant.now().plusSeconds(30));
    runningJob(nearExpiry);
    when(store.findAttempt(nearExpiry.attemptId())).thenReturn(Optional.of(nearExpiry));
    when(store.updateAttempt(any(), anyLong(), anyLong())).thenReturn(true);

    assertFalse(service.canceled("device", nearExpiry.attemptId(), "lease"));

    var saved = ArgumentCaptor.forClass(ChapterAnalysisExecutionAttempt.class);
    verify(store)
        .updateAttempt(saved.capture(), eq(nearExpiry.rowVersion()), eq(nearExpiry.fencingToken()));
    assertTrue(saved.getValue().leaseExpiresAt().isAfter(Instant.now().plusSeconds(90)));
    assertEquals(nearExpiry.lastObservationSequence(), saved.getValue().lastObservationSequence());
  }

  @Test
  void theCancellationPollLeavesAHealthyLeaseAlone() {
    authenticate();
    var healthy =
        attempt(
            ChapterAnalysisAttemptCheckpoint.LOCAL_RUNNING,
            null,
            1,
            Instant.now().plusSeconds(115));
    runningJob(healthy);
    when(store.findAttempt(healthy.attemptId())).thenReturn(Optional.of(healthy));

    assertFalse(service.canceled("device", healthy.attemptId(), "lease"));

    verify(store, never()).updateAttempt(any(), anyLong(), anyLong());
  }

  @Test
  void aResultForUnitsTheBackendNoLongerNumbersTheSameWayIsRejected() {
    authenticate();
    var running = attempt(ChapterAnalysisAttemptCheckpoint.LOCAL_RUNNING, null);
    runningJob(running);
    var snapshot = mock(ChapterAnalysisExecutionSnapshot.class);
    when(snapshot.inputFingerprint()).thenReturn("b".repeat(64));
    when(store.findAttempt(running.attemptId())).thenReturn(Optional.of(running));
    when(store.findRuntimeConfiguration()).thenReturn(configuration(1));
    when(store.findSnapshot(any())).thenReturn(Optional.of(snapshot));

    var thrown =
        assertThrows(
            IllegalArgumentException.class,
            () -> service.complete("device", running.attemptId(), completion()));

    assertEquals("SOURCE_UNITS_CHANGED", thrown.getMessage());
    verifyNoInteractions(handler);
  }

  @Test
  void validateReportsWhatTheMaterializerFindsWithoutWriting() {
    authenticate();
    var running = attempt(ChapterAnalysisAttemptCheckpoint.LOCAL_RUNNING, null);
    var job = runningJob(running);
    when(store.findAttempt(running.attemptId())).thenReturn(Optional.of(running));
    when(store.findRuntimeConfiguration()).thenReturn(configuration(1));
    when(handler.validate(job, "{}", 3, 9))
        .thenReturn(
            List.of(
                new com.narrativex.backend.feature.generation.infrastructure.dispatch
                    .ChapterAnalysisArtifactMaterializer.Violation(
                    com.narrativex.backend.feature.generation.infrastructure.dispatch
                        .ChapterAnalysisArtifactMaterializer.Severity.ERROR,
                    "scenes[0]",
                    "bad")));

    var found = service.validate("device", running.attemptId(), "lease", "{}", 3, 9);

    assertEquals(1, found.size());
    assertEquals("ERROR", found.get(0).severity());
    assertEquals("scenes[0]", found.get(0).path());
    verifyNoInteractions(transactions);
  }

  @Test
  void stagedValidationUsesTheFrozenSchemaForTheRequestedStage() {
    authenticate();
    var running = attempt(ChapterAnalysisAttemptCheckpoint.LOCAL_RUNNING, null);
    var job = runningJob(running);
    var snapshot = mock(ChapterAnalysisExecutionSnapshot.class);
    var schema = tools.jackson.databind.json.JsonMapper.builder().build().createObjectNode();
    schema.put("type", "object");
    var contracts =
        java.util.Map.of(
            ChapterAnalysisStage.CANON,
            new ChapterAnalysisStageContract("canon", schema, "a".repeat(64), "b".repeat(64)),
            ChapterAnalysisStage.STORY,
            new ChapterAnalysisStageContract("story", schema, "c".repeat(64), "d".repeat(64)));
    when(store.findAttempt(running.attemptId())).thenReturn(Optional.of(running));
    when(store.findRuntimeConfiguration()).thenReturn(configuration(1));
    when(store.findSnapshot(job.getId())).thenReturn(Optional.of(snapshot));
    when(snapshot.stageContracts()).thenReturn(contracts);
    when(handler.validateStage(
            eq(job), eq(ChapterAnalysisStage.CANON), eq("{}"), eq(3), eq(9), any(), any()))
        .thenReturn(List.of());

    var found =
        service.validateStage(
            "device", running.attemptId(), "lease", "{}", 3, 9, ChapterAnalysisStage.CANON, schema);

    assertTrue(found.isEmpty());
    verify(handler)
        .validateStage(
            eq(job),
            eq(ChapterAnalysisStage.CANON),
            eq("{}"),
            eq(3),
            eq(9),
            eq(schema),
            eq(contracts.get(ChapterAnalysisStage.CANON).responseSchema()));
    verifyNoInteractions(transactions);
  }

  @Test
  void progressOfAHeldAttemptIsRecordedOnItsJob() {
    authenticate();
    var running = attempt(ChapterAnalysisAttemptCheckpoint.LOCAL_RUNNING, null);
    var job = runningJob(running);
    when(store.findAttempt(running.attemptId())).thenReturn(Optional.of(running));

    service.progress("device", running.attemptId(), "lease", 55);

    verify(transactions).recordProgress(job.getJobId(), 55);
  }

  @Test
  void stagedProgressUsesTheServerOwnedStageLabel() {
    authenticate();
    var running = attempt(ChapterAnalysisAttemptCheckpoint.LOCAL_RUNNING, null);
    var job = runningJob(running);
    var snapshot = mock(ChapterAnalysisExecutionSnapshot.class);
    var schema = tools.jackson.databind.json.JsonMapper.builder().build().createObjectNode();
    schema.put("type", "object");
    when(store.findAttempt(running.attemptId())).thenReturn(Optional.of(running));
    when(store.findSnapshot(job.getId())).thenReturn(Optional.of(snapshot));
    when(snapshot.stageContracts())
        .thenReturn(
            java.util.Map.of(
                ChapterAnalysisStage.CANON,
                new ChapterAnalysisStageContract("canon", schema, "a".repeat(64), "b".repeat(64)),
                ChapterAnalysisStage.STORY,
                new ChapterAnalysisStageContract("story", schema, "c".repeat(64), "d".repeat(64))));

    service.progressStage("device", running.attemptId(), "lease", 55, ChapterAnalysisStage.STORY);

    verify(transactions).recordProgress(job.getJobId(), 55, "ANTIGRAVITY_ANALYSIS_STORY");
  }

  @Test
  void progressForAnAttemptThatNoLongerHoldsItsSlotIsIgnored() {
    authenticate();
    var delivered = attempt(ChapterAnalysisAttemptCheckpoint.DELIVERED, "f".repeat(64));
    when(store.findAttempt(delivered.attemptId())).thenReturn(Optional.of(delivered));

    service.progress("device", delivered.attemptId(), "lease", 55);

    verifyNoInteractions(transactions);
  }

  @Test
  void progressLosingARaceWithTheResultIsNotAnError() {
    authenticate();
    var running = attempt(ChapterAnalysisAttemptCheckpoint.LOCAL_RUNNING, null);
    var job = runningJob(running);
    when(store.findAttempt(running.attemptId())).thenReturn(Optional.of(running));
    when(transactions.recordProgress(job.getJobId(), 55))
        .thenThrow(new org.springframework.dao.OptimisticLockingFailureException("raced"));

    assertDoesNotThrow(() -> service.progress("device", running.attemptId(), "lease", 55));
  }

  @Test
  void progressWithAnotherLeaseIsRejectedBeforeTouchingTheJob() {
    authenticate();
    var running = attempt(ChapterAnalysisAttemptCheckpoint.LOCAL_RUNNING, null);
    when(store.findAttempt(running.attemptId())).thenReturn(Optional.of(running));

    assertThrows(
        RuntimeException.class, () -> service.progress("device", running.attemptId(), "wrong", 55));
    verifyNoInteractions(transactions);
  }

  private GenerationJob runningJob(ChapterAnalysisExecutionAttempt attempt) {
    var job = mock(GenerationJob.class);
    when(job.getJobId()).thenReturn(UUID.randomUUID());
    when(job.getStatus()).thenReturn(JobStatus.RUNNING);
    when(jobs.findById(attempt.generationJobId())).thenReturn(Optional.of(job));
    return job;
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
      UUID owner, String connection, String quota, Instant nextEligible, String fingerprint) {
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
    return attempt(checkpoint, payloadHash, 1, Instant.now().plusSeconds(60));
  }

  private ChapterAnalysisExecutionAttempt attempt(
      ChapterAnalysisAttemptCheckpoint checkpoint,
      String payloadHash,
      int attemptNumber,
      Instant leaseExpiresAt) {
    return new ChapterAnalysisExecutionAttempt(
        UUID.randomUUID(),
        UUID.randomUUID(),
        attemptNumber,
        UUID.randomUUID(),
        device,
        UUID.randomUUID(),
        1,
        "a".repeat(64),
        checkpoint,
        CanonHashCalculator.sha256("lease"),
        leaseExpiresAt,
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
