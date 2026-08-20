package com.narrativex.backend.feature.generation.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.narrativex.backend.feature.account.application.port.in.PlanFeatures;
import com.narrativex.backend.feature.account.application.port.in.UserQuotaAccess;
import com.narrativex.backend.feature.common.exception.FeatureNotAvailableException;
import com.narrativex.backend.feature.generation.application.port.out.ChapterAnalysisSafetyGate;
import com.narrativex.backend.feature.generation.application.port.out.QuotaReservation;
import com.narrativex.backend.feature.generation.application.service.ChapterAnalysisAdmissionService;
import com.narrativex.backend.feature.generation.application.service.ChapterAnalysisCostEstimator;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSource;
import java.math.BigDecimal;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class ChapterAnalysisAdmissionServiceTest {
  private static final ChapterAnalysisSource SOURCE =
      new ChapterAnalysisSource(11L, 12L, 1L, "a".repeat(64), "A short chapter.");

  @Test
  void freePlanWithoutStoryAnalysisFeatureIsRejected() {
    var service = service(quota(false), new ReservationSpy(true));

    assertThrows(FeatureNotAvailableException.class, () -> service.admit("user-1", 7L, SOURCE));
  }

  @Test
  void atomicReservationDenialBecomesCostLimit() {
    var service = service(quota(true), new ReservationSpy(false));

    var exception =
        assertThrows(
            GenerationAdmissionDeniedException.class, () -> service.admit("user-1", 7L, SOURCE));
    assertEquals("COST_LIMIT", exception.getCode());
  }

  @Test
  void entitledRequestReturnsEstimateAndDurableReservation() {
    var reservation = new ReservationSpy(true);
    var service = service(quota(true), reservation);

    var admission = service.admit("user-1", 7L, SOURCE);

    assertEquals(new BigDecimal("0.010000"), admission.estimate().estimateMin());
    assertEquals(new BigDecimal("0.010016"), admission.estimate().estimateMax());
    assertEquals(0, new BigDecimal("0.020032").compareTo(reservation.cost));
    assertEquals(41L, admission.reservation().id());
  }

  private static ChapterAnalysisAdmissionService service(
      UserQuotaAccess.QuotaSnapshot quota, ReservationSpy reservation) {
    UserQuotaAccess quotaAccess = userId -> Optional.of(quota);
    ChapterAnalysisSafetyGate safetyGate = (projectId, source) -> {};
    return new ChapterAnalysisAdmissionService(
        quotaAccess, reservation, new ChapterAnalysisCostEstimator(), safetyGate);
  }

  private static UserQuotaAccess.QuotaSnapshot quota(boolean storyAnalysis) {
    return new UserQuotaAccess.QuotaSnapshot(
        new PlanFeatures(storyAnalysis), 4, 0, BigDecimal.ZERO, BigDecimal.valueOf(10));
  }

  private static final class ReservationSpy implements QuotaReservation {
    private final boolean allowed;
    private BigDecimal cost;

    private ReservationSpy(boolean allowed) {
      this.allowed = allowed;
    }

    @Override
    public Optional<Reservation> reserve(
        String userId, BigDecimal estimatedCost, int maxConcurrentExpensiveJobs) {
      cost = estimatedCost;
      if (!allowed) {
        return Optional.empty();
      }
      return Optional.of(new Reservation(41L, userId, "2026-08", estimatedCost));
    }

    @Override
    public void bindToGenerationJob(long reservationId, long generationJobId) {}

    @Override
    public boolean consumeForJob(long generationJobId) {
      return false;
    }

    @Override
    public boolean releaseForJob(long generationJobId) {
      return false;
    }
  }
}
