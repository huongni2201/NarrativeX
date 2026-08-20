package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.account.application.port.in.UserQuotaAccess;
import com.narrativex.backend.feature.common.exception.FeatureNotAvailableException;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSource;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** Admission policy for user audio. It checks entitlement but never reserves TTS quota. */
@Service
@RequiredArgsConstructor
public class UploadedNarrationAdmission {
  private final UserQuotaAccess quotaQuery;

  public Admission admit(String userId, ChapterAnalysisSource source) {
    if (source == null || source.sourceText() == null || source.sourceText().isBlank()) {
      throw new IllegalArgumentException("source must contain text");
    }
    UserQuotaAccess.QuotaSnapshot quota =
        quotaQuery
            .findCurrentQuota(userId)
            .orElseThrow(() -> new GenerationAdmissionDeniedException("COST_LIMIT", "No active plan."));
    if (!quota.features().narrationEnabled()) {
      throw new FeatureNotAvailableException("Narration is not enabled for this plan.");
    }
    return new Admission(new NarrationCostEstimate(0, java.math.BigDecimal.ZERO, java.math.BigDecimal.ZERO, java.math.BigDecimal.ZERO));
  }

  public record Admission(NarrationCostEstimate ttsEstimate) {
    public boolean reservesTtsQuota() {
      return false;
    }
  }
}
