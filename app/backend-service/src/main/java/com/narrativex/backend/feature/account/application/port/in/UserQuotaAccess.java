package com.narrativex.backend.feature.account.application.port.in;

import java.math.BigDecimal;
import java.util.Optional;

/** Inbound account contract for feature admission decisions in other modules. */
public interface UserQuotaAccess {
  Optional<QuotaSnapshot> findCurrentQuota(String userId);

  record QuotaSnapshot(
      PlanFeatures features,
      int maxConcurrentExpensiveJobs,
      int expensiveJobsActive,
      BigDecimal creditsUsed,
      BigDecimal totalCredits) {}
}
