package com.narrativex.backend.feature.generation.api.response;

import com.narrativex.backend.feature.generation.application.port.out.ChapterContinuityRepository.CurrentContinuity;
import com.narrativex.backend.feature.generation.application.service.ContinuityIssueCodec;
import java.util.List;
import java.util.UUID;

public record ChapterContinuityResponse(
    UUID planId,
    int revision,
    String sourceHash,
    String status,
    int reportRevision,
    List<IssueResponse> issues) {

  public static ChapterContinuityResponse from(
      CurrentContinuity continuity, ContinuityIssueCodec codec) {
    return new ChapterContinuityResponse(
        continuity.planId(),
        continuity.planRevision(),
        continuity.sourceHash(),
        continuity.reportStatus(),
        continuity.reportRevision(),
        codec.decode(continuity.issuesJson()).stream().map(IssueResponse::from).toList());
  }

  public record IssueResponse(
      String id,
      String code,
      String severity,
      List<String> scopeKeys,
      List<String> evidenceAnchors,
      String message,
      String origin) {
    static IssueResponse from(ContinuityIssueCodec.Issue issue) {
      return new IssueResponse(
          issue.id(),
          issue.code(),
          issue.severity(),
          issue.scopeKeys(),
          issue.evidenceAnchors(),
          issue.message(),
          issue.origin());
    }
  }
}
