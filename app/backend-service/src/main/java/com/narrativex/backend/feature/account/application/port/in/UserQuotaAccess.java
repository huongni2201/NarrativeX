package com.narrativex.backend.feature.account.application.port.in;

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
      int shortExportsUsed) {}
}
