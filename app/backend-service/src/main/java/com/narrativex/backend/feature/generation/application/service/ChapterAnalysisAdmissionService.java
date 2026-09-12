package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.account.application.port.in.UserQuotaAccess;
import com.narrativex.backend.feature.common.exception.FeatureNotAvailableException;
import com.narrativex.backend.feature.generation.application.port.out.QuotaReservation;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSource;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ChapterAnalysisAdmissionService {
  private final UserQuotaAccess quotaQuery;
  private final QuotaReservation quotaReservation;

  public Admission admit(String userId, UUID projectId, ChapterAnalysisSource source) {
    UserQuotaAccess.QuotaSnapshot quota =
        quotaQuery
            .findCurrentQuota(userId)
            .orElseThrow(
                () ->
                    new GenerationAdmissionDeniedException(
                        "ENTITLEMENT_DENIED", "No active plan."));

    requireEntitled(quota);
    QuotaReservation.Reservation reservation =
        quotaReservation
            .reserve(userId, quota.maxConcurrentExpensiveJobs())
            .orElseThrow(
                () ->
                    new GenerationAdmissionDeniedException(
                        "CAPACITY_LIMIT", "The story-analysis concurrency quota is exhausted."));
    return new Admission(reservation);
  }

  private static void requireEntitled(UserQuotaAccess.QuotaSnapshot quota) {
    if (!quota.features().storyAnalysisEnabled()) {
      throw new FeatureNotAvailableException("Story analysis is not enabled for this plan.");
    }
  }

  public record Admission(QuotaReservation.Reservation reservation) {}
}
