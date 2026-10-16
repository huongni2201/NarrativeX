package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.application.model.compute.InputArtifactRefDto;
import com.narrativex.backend.feature.generation.application.model.compute.OutputArtifactTargetDto;
import com.narrativex.backend.feature.generation.application.model.compute.ProducedArtifactDto;
import java.util.UUID;

/** Backend-owned capability boundary for compute input/output bytes. */
public interface ComputeArtifactAccess {
  OutputArtifactTargetDto createOutput(UUID taskId, UUID attemptId, String role, String mediaType);

  InputArtifactRefDto createInput(UUID projectId, UUID assetId, String role);

  /** Grants read access to an installation-wide (GLOBAL_LOCAL) voice reference recording. */
  InputArtifactRefDto createVoiceReferenceInput(UUID voiceReferenceAssetId, String role);

  void verifyOutput(OutputArtifactTargetDto target, ProducedArtifactDto produced);

  byte[] readOutput(OutputArtifactTargetDto target);

  String storageKey(OutputArtifactTargetDto target);

  default OutputArtifactTargetDto getOrCreateTarget(
      UUID taskId, UUID attemptId, UUID artifactId, String role, String mediaType) {
    return createOutput(taskId, attemptId, role, mediaType);
  }
}
