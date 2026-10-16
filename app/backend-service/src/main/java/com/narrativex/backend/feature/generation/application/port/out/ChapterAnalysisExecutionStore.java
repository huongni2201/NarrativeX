package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.application.model.analysis.AnalysisProviderCredential;
import com.narrativex.backend.feature.generation.application.model.analysis.AnalysisRuntimeConfiguration;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisExecutionAttempt;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisExecutionSnapshot;
import java.util.Optional;
import java.util.UUID;

/** Durable storage for Chapter Analysis runtime settings, metadata, snapshots, and attempts. */
public interface ChapterAnalysisExecutionStore {
  AnalysisRuntimeConfiguration findRuntimeConfiguration();

  Optional<AnalysisRuntimeConfiguration> updateRuntimeConfiguration(
      AnalysisRuntimeConfiguration desired, long expectedRowVersion);

  Optional<AnalysisProviderCredential> findCredential(UUID credentialRef);

  Optional<AnalysisProviderCredential> findCredentialByDevice(UUID deviceId);

  AnalysisProviderCredential insertCredential(AnalysisProviderCredential credential);

  Optional<AnalysisProviderCredential> updateCredential(
      AnalysisProviderCredential credential, long expectedRowVersion);

  ChapterAnalysisExecutionSnapshot saveSnapshot(ChapterAnalysisExecutionSnapshot snapshot);

  Optional<ChapterAnalysisExecutionSnapshot> findSnapshot(UUID generationJobId);

  ChapterAnalysisExecutionAttempt insertAttempt(ChapterAnalysisExecutionAttempt attempt);

  Optional<ChapterAnalysisExecutionAttempt> findAttempt(UUID attemptId);

  Optional<ChapterAnalysisExecutionAttempt> findAttemptByClaimRequest(
      UUID deviceId, UUID claimRequestId);

  Optional<ChapterAnalysisExecutionAttempt> findActiveAttempt(UUID generationJobId);

  boolean updateAttempt(
      ChapterAnalysisExecutionAttempt attempt, long expectedRowVersion, long expectedFencingToken);
}
