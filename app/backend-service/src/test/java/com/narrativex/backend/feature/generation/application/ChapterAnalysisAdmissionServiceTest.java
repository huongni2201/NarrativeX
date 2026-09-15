package com.narrativex.backend.feature.generation.application;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.account.application.port.in.PlanFeatures;
import com.narrativex.backend.feature.account.application.port.in.UserQuotaAccess;
import com.narrativex.backend.configuration.NarrativeXLimitsProperties;
import com.narrativex.backend.feature.common.exception.FeatureNotAvailableException;
import com.narrativex.backend.feature.generation.application.port.out.QuotaReservation;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.service.ChapterAnalysisAdmissionService;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ChapterAnalysisAdmissionServiceTest {

  @Test
  void freePlanWithoutStoryAnalysisFeatureIsRejected() {
    var service = service(quota(false), new ReservationSpy(true));
  void disabledStoryAnalysisIsRejected() {
    var limits = new NarrativeXLimitsProperties();
    limits.setStoryAnalysisEnabled(false);
    var repository = mock(GenerationJobRepository.class);
    var service = new ChapterAnalysisAdmissionService(limits, repository);

    assertThrows(
        FeatureNotAvailableException.class, () -> service.admit("user-1"));
    assertThrows(FeatureNotAvailableException.class, service::admit);
  }

  @Test
  void atomicReservationDenialBecomesCapacityLimit() {
    var service = service(quota(true), new ReservationSpy(false));
  void activeJobsExceedingLimitRejectsWithCapacityLimit() {
    var limits = new NarrativeXLimitsProperties();
    limits.setStoryAnalysisEnabled(true);
    limits.setMaxConcurrentExpensiveJobs(2);
    var repository = mock(GenerationJobRepository.class);
    when(repository.countActiveJobs()).thenReturn(2);
    var service = new ChapterAnalysisAdmissionService(limits, repository);

    var exception =
        assertThrows(
            GenerationAdmissionDeniedException.class,
            () -> service.admit("user-1"));
    var exception = assertThrows(GenerationAdmissionDeniedException.class, service::admit);
    assertEquals("CAPACITY_LIMIT", exception.getCode());
    verify(repository).acquireAnalysisCapacityLock();
  }

  @Test
  void entitledRequestReturnsDurableCapacityReservation() {
    var reservation = new ReservationSpy(true);
    var service = service(quota(true), reservation);
  void withinLimitsAdmitsSuccessfully() {
    var limits = new NarrativeXLimitsProperties();
    limits.setStoryAnalysisEnabled(true);
    limits.setMaxConcurrentExpensiveJobs(2);
    var repository = mock(GenerationJobRepository.class);
    when(repository.countActiveJobs()).thenReturn(1);
    var service = new ChapterAnalysisAdmissionService(limits, repository);

    var admission = service.admit("user-1");

    assertEquals(41L, admission.reservation().id());
    assertEquals("CAPACITY", admission.reservation().quotaKind());
    assertEquals(1, admission.reservation().units());
    assertEquals(4, reservation.maxConcurrentExpensiveJobs);
    assertDoesNotThrow(service::admit);
    verify(repository).acquireAnalysisCapacityLock();
  }

  private static ChapterAnalysisAdmissionService service(
      UserQuotaAccess.QuotaSnapshot quota, ReservationSpy reservation) {
    UserQuotaAccess quotaAccess = userId -> Optional.of(quota);
    return new ChapterAnalysisAdmissionService(quotaAccess, reservation);
  }

  private static UserQuotaAccess.QuotaSnapshot quota(boolean storyAnalysis) {
    return new UserQuotaAccess.QuotaSnapshot(
        new PlanFeatures(storyAnalysis),
        4,
        0,
        true,
        "ULTRA",
        null,
        null,
        0,
        0);
  }

  private static final class ReservationSpy implements QuotaReservation {
    private final boolean allowed;
    private int maxConcurrentExpensiveJobs;

    private ReservationSpy(boolean allowed) {
      this.allowed = allowed;
    }

    @Override
    public Optional<Reservation> reserve(String userId, int maxConcurrentExpensiveJobs) {
      this.maxConcurrentExpensiveJobs = maxConcurrentExpensiveJobs;
      if (!allowed) {
        return Optional.empty();
      }
      return Optional.of(new Reservation(41L, userId, "2026-09", "CAPACITY", 1));
    }

    @Override
    public void bindToGenerationJob(long reservationId, UUID generationJobId) {}

    @Override
    public boolean consumeForJob(UUID generationJobId) {
      return false;
    }

    @Override
    public boolean releaseForJob(UUID generationJobId) {
      return false;
    }
  }
}
