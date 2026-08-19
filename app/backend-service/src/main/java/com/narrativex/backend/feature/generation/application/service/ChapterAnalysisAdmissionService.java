package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.account.application.port.in.UserQuotaAccess;
import com.narrativex.backend.feature.common.exception.FeatureNotAvailableException;
import com.narrativex.backend.feature.generation.application.port.out.ChapterAnalysisSafetyGate;
import com.narrativex.backend.feature.generation.application.port.out.QuotaReservation;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSource;
import java.math.BigDecimal;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ChapterAnalysisAdmissionService {
  private final UserQuotaAccess quotaQuery;
  private final QuotaReservation quotaReservation;
  private final ChapterAnalysisCostEstimator costEstimator;
  private final ChapterAnalysisSafetyGate safetyGate;

  public ChapterAnalysisCostEstimate admit(
      String userId, Long projectId, ChapterAnalysisSource source) {
    safetyGate.requireAllowed(projectId, source);
    ChapterAnalysisCostEstimate estimate = costEstimator.estimate(source.sourceText());
    UserQuotaAccess.QuotaSnapshot quota =
        quotaQuery
            .findCurrentQuota(userId)
            .orElseThrow(
                () -> new GenerationAdmissionDeniedException("COST_LIMIT", "No active plan."));

    requireEntitled(quota, estimate.maxAuthorizedCost());
    if (!quotaReservation.reserve(
        userId, estimate.maxAuthorizedCost(), quota.maxConcurrentExpensiveJobs())) {
      throw new GenerationAdmissionDeniedException(
          "COST_LIMIT", "The story-analysis quota is exhausted.");
    }
    return estimate;
  }

  private static void requireEntitled(
      UserQuotaAccess.QuotaSnapshot quota, BigDecimal authorizedCost) {
    if (!featureEnabled(quota.featureFlagsJson(), "storyAnalysis")) {
      throw new FeatureNotAvailableException("Story analysis is not enabled for this plan.");
    }
    if (quota.expensiveJobsActive() >= quota.maxConcurrentExpensiveJobs()) {
      throw new GenerationAdmissionDeniedException(
          "COST_LIMIT", "The maximum number of concurrent expensive jobs is active.");
    }
    if (quota.totalCredits() == null
        || quota.creditsUsed().add(authorizedCost).compareTo(quota.totalCredits()) > 0) {
      throw new GenerationAdmissionDeniedException(
          "COST_LIMIT", "The story-analysis credit quota is exhausted.");
    }
  }

  private static boolean featureEnabled(String json, String feature) {
    return json != null
        && json.replace("\\\"", "\"").matches(".*\\\"" + feature + "\\\"\\s*:\\s*true.*");
  }
}
