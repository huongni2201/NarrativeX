package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.generation.application.port.out.ChapterContinuityRepository;
import com.narrativex.backend.feature.generation.application.query.ContinuityView;
import com.narrativex.backend.feature.generation.application.service.ContinuityIssueCodec;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ReviewContinuityIssuesUseCase {
  private final CurrentUserId currentUserId;
  private final ChapterAnalysisSourceAccess chapterSourceAccess;
  private final ChapterContinuityRepository continuityRepository;
  private final ContinuityIssueCodec issueCodec;

  @Transactional
  public ContinuityView execute(
      UUID projectId, UUID chapterId, UUID planId, int reportRevision, List<String> issueIds) {
    String userId = currentUserId.get();
    chapterSourceAccess.requireOwnedForAnalysisLocked(projectId, chapterId, userId);
    var current =
        continuityRepository
            .findCurrent(projectId, chapterId)
            .orElseThrow(() -> new ResourceConflictException("CONTINUITY_INPUT_STALE"));
    if (!current.planId().equals(planId) || current.reportRevision() != reportRevision) {
      throw new ResourceConflictException("CONTINUITY_INPUT_STALE");
    }

    Set<String> selectedIds = new LinkedHashSet<>(issueIds);
    var issues = issueCodec.decode(current.issuesJson());
    Set<String> knownIds =
        issues.stream()
            .map(ContinuityIssueCodec.Issue::id)
            .collect(java.util.stream.Collectors.toSet());
    if (selectedIds.isEmpty() || !knownIds.containsAll(selectedIds)) {
      throw new ResourceConflictException("CONTINUITY_INPUT_STALE");
    }
    if (issues.stream()
        .filter(issue -> selectedIds.contains(issue.id()))
        .anyMatch(issue -> !"WARNING".equals(issue.severity()))) {
      throw new ResourceConflictException("CONTINUITY_CONFLICT");
    }

    var remaining = issues.stream().filter(issue -> !selectedIds.contains(issue.id())).toList();
    String status = remaining.isEmpty() ? "PASS" : "NEEDS_REVIEW";
    int nextRevision = continuityRepository.nextReportRevision(planId);
    continuityRepository.appendHumanReport(
        planId, nextRevision, status, issueCodec.encodeRaw(remaining), userId);

    return new ContinuityView(
        current.planId(),
        current.planRevision(),
        current.sourceHash(),
        status,
        nextRevision,
        issueCodec.encodeRaw(remaining));
  }
}
