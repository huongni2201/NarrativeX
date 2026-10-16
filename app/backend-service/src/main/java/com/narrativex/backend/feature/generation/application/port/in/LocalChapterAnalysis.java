package com.narrativex.backend.feature.generation.application.port.in;

import com.narrativex.backend.feature.generation.application.model.analysis.AnalysisProviderCredential;
import com.narrativex.backend.feature.generation.application.model.analysis.AnalysisRuntimeConfiguration;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisExecutionProfile;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisUsage;
import com.narrativex.backend.feature.generation.domain.enums.ChapterAnalysisExecutionMode;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import tools.jackson.databind.JsonNode;

/**
 * Chapter Analysis executed through the one agy session owned by a Desktop device (ADR-0009). The
 * backend owns admission, the frozen prompt snapshot, leases and result validation; Desktop claims
 * work, runs the CLI and reports back.
 */
public interface LocalChapterAnalysis {
  AnalysisRuntimeConfiguration configuration();

  AnalysisRuntimeConfiguration configure(
      ChapterAnalysisExecutionMode mode,
      String model,
      String effort,
      int maxConcurrentAnalyses,
      long rowVersion);

  AnalysisProviderCredential registerCredential(
      String deviceToken,
      String fingerprint,
      String label,
      String adapterVersion,
      List<String> models);

  void observeCredential(
      String deviceToken,
      UUID credentialRef,
      String connectionState,
      String quotaState,
      Instant nextEligibleAt);

  /**
   * Hands the next queued chapter to the device, or returns {@code null} when nothing can be
   * claimed.
   */
  Claim claim(String deviceToken, UUID claimRequestId, UUID credentialRef, String adapterVersion);

  void complete(String deviceToken, UUID attemptId, Completion completion);

  /**
   * Checks a result without writing anything and lists every problem, so one repair pass can fix
   * them all. {@code windowFirst}/{@code windowLast} (inclusive unit indexes, {@code -1} for the
   * whole chapter) bound a partial result produced for one window of a long chapter.
   */
  List<Violation> validate(
      String deviceToken,
      UUID attemptId,
      String lease,
      String rawJson,
      int windowFirst,
      int windowLast);

  void report(String deviceToken, UUID attemptId, String lease, String code, boolean ambiguous);

  void recoverClaim(String deviceToken, UUID claimRequestId);

  /**
   * Reports how far a running analysis got (0..99). Best effort: it only ever raises the job's
   * progress and is ignored once the attempt or job is no longer running.
   */
  void progress(String deviceToken, UUID attemptId, String lease, int progress);

  /**
   * Whether the person asked to cancel; also the heartbeat that keeps a long-running lease alive.
   */
  boolean canceled(String deviceToken, UUID attemptId, String lease);

  record Claim(
      UUID jobId,
      UUID projectId,
      UUID attemptId,
      String leaseToken,
      List<ClaimUnit> sourceUnits,
      String sourceLanguage,
      ChapterAnalysisExecutionProfile profile,
      String promptTemplate,
      JsonNode responseSchema,
      long maxInputBytes,
      long maxOutputBytes,
      long maxRuntimeMs) {}

  /**
   * One numbered piece of the chapter; the model refers to {@code index} instead of copying text.
   */
  record ClaimUnit(int index, String text) {}

  record Completion(
      String leaseToken,
      String rawJson,
      ChapterAnalysisUsage usage,
      String adapterVersion,
      String conversationId) {}

  /**
   * {@code severity} is {@code ERROR} (must be fixed) or {@code WARNING} (accepted, worth
   * improving).
   */
  record Violation(String severity, String path, String message) {}
}
