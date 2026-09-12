package com.narrativex.backend.feature.account.application.port.in;

import java.math.BigDecimal;
import java.util.Optional;

/** Inbound account contract for non-monetary feature and capacity admission decisions. */
public interface UserQuotaAccess {
  Optional<QuotaSnapshot> findCurrentQuota(String userId);

  record QuotaSnapshot(
      PlanFeatures features,
      int maxConcurrentExpensiveJobs,
      int expensiveJobsActive,
      boolean watermarkRequired,
      String maxVideoQuality,
      Integer maxLongformExportsMonth,
      Integer maxShortExportsMonth,
      int longformExportsUsed,
      int shortExportsUsed) {
    /** Compatibility constructor for callers not yet migrated from the retired credit contract. */
    public QuotaSnapshot(
        PlanFeatures features,
        int maxConcurrentExpensiveJobs,
        int expensiveJobsActive,
        BigDecimal ignoredCreditsUsed,
        BigDecimal ignoredTotalCredits) {
      this(
          features,
          maxConcurrentExpensiveJobs,
          expensiveJobsActive,
          true,
          "ULTRA",
          null,
          null,
          0,
          0);
    }
  }
}
