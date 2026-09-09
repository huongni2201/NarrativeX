package com.narrativex.backend.feature.generation.application.query;

import com.narrativex.backend.feature.generation.application.port.out.ChapterContinuityRepository.CurrentContinuity;
import java.util.UUID;

public record ContinuityView(
    UUID planId,
    int planRevision,
    String sourceHash,
    String reportStatus,
    int reportRevision,
    String issuesJson) {
  public static ContinuityView from(CurrentContinuity continuity) {
    return new ContinuityView(
        continuity.planId(),
        continuity.planRevision(),
        continuity.sourceHash(),
        continuity.reportStatus(),
        continuity.reportRevision(),
        continuity.issuesJson());
  }
}
