package com.narrativex.backend.feature.generation.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

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
    var service = service(quota("{}", 0, 10));
    assertThrows(FeatureNotAvailableException.class, () -> service.admit("user-1", 7L, SOURCE));
  }

  @Test
  void exhaustedCreditQuotaIsRejectedBeforeReservation() {
    var service = service(quota("{\"storyAnalysis\":true}", 1, 0.05));
    var exception = assertThrows(
        GenerationAdmissionDeniedException.class, () -> service.admit("user-1", 7L, SOURCE));
    assertEquals("COST_LIMIT", exception.getCode());
  }

  @Test
  void protectedStoryboardIsRejectedBeforeCostOrQuotaReservation() {
    var reservation = new ReservationSpy();
    ChapterAnalysisSafetyGate gate =
        (projectId, source) -> {
          throw new GenerationAdmissionDeniedException(
              "APPROVED_STORYBOARD_PROTECTED", "approved storyboard is immutable");
        };
    var service = service(quota("{\"storyAnalysis\":true}", 0, 10), reservation, gate);

    var exception = assertThrows(
        GenerationAdmissionDeniedException.class, () -> service.admit("user-1", 7L, SOURCE));

    assertEquals("APPROVED_STORYBOARD_PROTECTED", exception.getCode());
    assertNull(reservation.cost);
  }

  @Test
  void entitledRequestProducesNonZeroOperationEstimate() {
    var reservation = new ReservationSpy();
    var service = service(quota("{\"storyAnalysis\":true}", 0, 10), reservation);
    var estimate = service.admit("user-1", 7L, SOURCE);
    assertEquals(new BigDecimal("0.010000"), estimate.estimateMin());
    assertEquals(new BigDecimal("0.010016"), estimate.estimateMax());
    assertEquals(0, new BigDecimal("0.020032").compareTo(reservation.cost));
  }

  private static ChapterAnalysisAdmissionService service(UserQuotaAccess.QuotaSnapshot quota) {
    return service(quota, new ReservationSpy());
  }

  private static ChapterAnalysisAdmissionService service(
      UserQuotaAccess.QuotaSnapshot quota, ReservationSpy reservation) {
    return service(quota, reservation, (projectId, source) -> {});
  }

  private static ChapterAnalysisAdmissionService service(
      UserQuotaAccess.QuotaSnapshot quota,
      ReservationSpy reservation,
      ChapterAnalysisSafetyGate safetyGate) {
    UserQuotaAccess quotaAccess = userId -> Optional.of(quota);
    return new ChapterAnalysisAdmissionService(
        quotaAccess, reservation, new ChapterAnalysisCostEstimator(), safetyGate);
  }

  private static UserQuotaAccess.QuotaSnapshot quota(
      String flags, int activeJobs, double totalCredits) {
    return new UserQuotaAccess.QuotaSnapshot(
        flags, 1, activeJobs, BigDecimal.ZERO, BigDecimal.valueOf(totalCredits));
  }

  private static final class ReservationSpy implements QuotaReservation {
    private BigDecimal cost;

    @Override
    public boolean reserve(
        String userId, BigDecimal estimatedCost, int maxConcurrentExpensiveJobs) {
      cost = estimatedCost;
      return true;
    }
  }
}
