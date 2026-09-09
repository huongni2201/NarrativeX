package com.narrativex.backend.feature.account.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.account.infrastructure.persistence.mybatis.QuotaMapper;
import com.narrativex.backend.feature.account.infrastructure.persistence.mybatis.QuotaReservationRow;
import com.narrativex.backend.feature.generation.application.port.out.QuotaReservation;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class MyBatisQuotaReservation implements QuotaReservation {
  private final QuotaMapper mapper;

  @Override
  @Transactional
  public Optional<Reservation> reserve(
      String userId, BigDecimal estimatedCost, int maxConcurrentExpensiveJobs) {
    return reserve(userId, estimatedCost, maxConcurrentExpensiveJobs, null, "CREDIT", 0);
  }

  @Override
  @Transactional
  public Optional<Reservation> reserveLongformExport(
      String userId,
      BigDecimal estimatedCost,
      int maxConcurrentExpensiveJobs,
      Integer maxLongformExportsMonth) {
    return reserve(
        userId,
        estimatedCost,
        maxConcurrentExpensiveJobs,
        maxLongformExportsMonth,
        "LONGFORM_EXPORT",
        1);
  }

  private Optional<Reservation> reserve(
      String userId,
      BigDecimal estimatedCost,
      int maxConcurrentExpensiveJobs,
      Integer maxLongformExportsMonth,
      String quotaKind,
      int units) {
    if (estimatedCost == null || estimatedCost.signum() < 0) {
      throw new IllegalArgumentException("estimatedCost must be non-negative");
    }
    var activePlan = mapper.findActivePlanForUpdate(userId);
    if (activePlan == null) {
      return Optional.empty();
    }
    String periodKey = mapper.currentPeriodKey();
    mapper.ensureUsageWindow(userId, periodKey);
    int longformExportsUsed = mapper.findLongformExportsUsedForUpdate(userId, periodKey);
    if (mapper.countActiveReservations(userId) >= maxConcurrentExpensiveJobs) {
      return Optional.empty();
    }
    if (maxLongformExportsMonth != null
        && longformExportsUsed + mapper.findReservedLongformExports(userId, periodKey) + units
            > maxLongformExportsMonth) {
      return Optional.empty();
    }
    if (activePlan.getMonthlyCredits() != null) {
      BigDecimal creditsUsed = zero(mapper.findCreditsUsedForUpdate(userId, periodKey));
      BigDecimal creditsReserved = zero(mapper.findCreditsReserved(userId, periodKey));
      if (creditsUsed
              .add(creditsReserved)
              .add(estimatedCost)
              .compareTo(activePlan.getMonthlyCredits())
          > 0) {
        return Optional.empty();
      }
    }
    Long reservationId =
        mapper.insertReservation(
            new QuotaReservationRow(userId, periodKey, estimatedCost, quotaKind, units));
    if (reservationId == null) {
      throw new IllegalStateException("Quota reservation insert returned no id");
    }
    return Optional.of(
        new Reservation(reservationId, userId, periodKey, estimatedCost, quotaKind, units));
  }

  @Override
  @Transactional
  public void bindToGenerationJob(long reservationId, UUID generationJobId) {
    if (mapper.bindToGenerationJob(reservationId, generationJobId) != 1) {
      throw new IllegalStateException(
          "Quota reservation " + reservationId + " cannot be bound to job " + generationJobId);
    }
  }

  @Override
  @Transactional
  public boolean consumeForJob(UUID generationJobId) {
    if (mapper.countBilledOperations(generationJobId) == 0) {
      return false;
    }
    return mapper.consumeForJob(generationJobId) == 1;
  }

  @Override
  @Transactional
  public boolean releaseForJob(UUID generationJobId) {
    return mapper.releaseForJob(generationJobId) == 1;
  }

  private static BigDecimal zero(BigDecimal value) {
    return value == null ? BigDecimal.ZERO : value;
  }
}
