package com.narrativex.backend.feature.account.application.query;

import java.math.BigDecimal;
import java.time.LocalDate;

public record UserQuotaView(
    String planKey,
    String status,
    LocalDate periodStart,
    LocalDate periodEnd,
    boolean watermarkRequired,
    String maxVideoQuality,
    Integer maxLongformExportsMonth,
    Integer maxShortExportsMonth,
    int maxConcurrentExpensiveJobs,
    String featureFlagsJson,
    int longformExportsUsed,
    int shortExportsUsed,
    int expensiveJobsActive,
    BigDecimal creditsUsed,
    BigDecimal totalCredits,
    BigDecimal remainingCredits) {}
