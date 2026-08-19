package com.narrativex.backend.feature.account.api.response;

import com.narrativex.backend.feature.account.application.query.UserQuotaView;
import java.math.BigDecimal;
import java.time.LocalDate;

public record UserQuotaResponse(
    String tier,
    String status,
    LocalDate periodStart,
    LocalDate periodEnd,
    Limits limits,
    Usage usage,
    BigDecimal totalCredits,
    BigDecimal remainingCredits) {

  public static UserQuotaResponse from(UserQuotaView view) {
    return new UserQuotaResponse(
        view.planKey(),
        view.status(),
        view.periodStart(),
        view.periodEnd(),
        new Limits(
            view.watermarkRequired(),
            view.maxVideoQuality(),
            view.maxLongformExportsMonth(),
            view.maxShortExportsMonth(),
            view.maxConcurrentExpensiveJobs(),
            view.featureFlagsJson()),
        new Usage(
            view.longformExportsUsed(),
            view.shortExportsUsed(),
            view.expensiveJobsActive(),
            view.creditsUsed()),
        view.totalCredits(),
        view.remainingCredits());
  }

  public record Limits(
      boolean watermarkRequired,
      String maxVideoQuality,
      Integer maxLongformExportsMonth,
      Integer maxShortExportsMonth,
      int maxConcurrentExpensiveJobs,
      String featureFlagsJson) {}

  public record Usage(
      int longformExports,
      int shortExports,
      int expensiveJobsActive,
      BigDecimal creditsUsed) {}
}
