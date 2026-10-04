package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.application.model.compute.ComputeTargetAssignment;
import java.util.Optional;
import java.util.UUID;

public interface ComputeTargetAssignmentStore {
  ComputeTargetAssignment pin(
      UUID taskId, UUID attemptId, String executor, String proposedTargetId);

  Optional<ComputeTargetAssignment> find(UUID taskId, UUID attemptId);
}
