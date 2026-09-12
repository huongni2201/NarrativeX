package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.account.application.port.in.UserQuotaAccess;
import com.narrativex.backend.feature.common.exception.FeatureNotAvailableException;
import com.narrativex.backend.feature.generation.application.port.out.QuotaReservation;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSource;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class NarrationAdmissionService {
  private final UserQuotaAccess quotaQuery;
  private final QuotaReservation quotaReservation;

  public Admission admit(String userId, ChapterAnalysisSource source, boolean localExecution) {
    return admitText(userId, source.sourceText(), localExecution);
  }

  public Admission admitText(String userId, String sourceText, boolean localExecution) {
    UserQuotaAccess.QuotaSnapshot quota =
        quotaQuery
            .findCurrentQuota(userId)
            .orElseThrow(
                () ->
                    new GenerationAdmissionDeniedException(
                        "ENTITLEMENT_DENIED", "No active plan."));
    if (!quota.features().narrationEnabled()) {
      throw new FeatureNotAvailableException("Narration is not enabled for this plan.");
    }
    QuotaReservation.Reservation reservation =
        quotaReservation
            .reserve(userId, quota.maxConcurrentExpensiveJobs())
            .orElseThrow(
                () ->
                    new GenerationAdmissionDeniedException(
                        "CAPACITY_LIMIT", "The narration concurrency quota is exhausted."));
    return new Admission(reservation);
  }

  public Admission admit(String userId, ChapterAnalysisSource source, String voiceId) {
    return admit(userId, source, voiceId != null && voiceId.startsWith("vieneu-"));
  }

  public Admission admit(String userId, ChapterAnalysisSource source) {
    return admit(userId, source, false);
  }

  public record Admission(QuotaReservation.Reservation reservation) {}
}
