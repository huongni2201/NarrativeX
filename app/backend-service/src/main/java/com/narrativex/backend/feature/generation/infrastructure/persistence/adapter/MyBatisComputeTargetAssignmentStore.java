package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.model.compute.ComputeTargetAssignment;
import com.narrativex.backend.feature.generation.application.port.out.ComputeTargetAssignmentStore;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ComputeTargetAssignmentMapper;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
@RequiredArgsConstructor
public class MyBatisComputeTargetAssignmentStore implements ComputeTargetAssignmentStore {
  private final ComputeTargetAssignmentMapper mapper;

  @Override
  @Transactional
  public ComputeTargetAssignment pin(
      UUID taskId, UUID attemptId, String executor, String proposedTargetId) {
    if (executor == null
        || executor.isBlank()
        || proposedTargetId == null
        || proposedTargetId.isBlank()) {
      throw new IllegalArgumentException("Compute target identity is required");
    }
    mapper.insert(new ComputeTargetAssignment(taskId, attemptId, executor, proposedTargetId));
    ComputeTargetAssignment pinned =
        find(taskId, attemptId)
            .orElseThrow(
                () -> new IllegalStateException("Compute target assignment was not persisted"));
    if (!executor.equals(pinned.executor())) {
      throw new IllegalStateException("Compute attempt was replayed with a different executor");
    }
    return pinned;
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<ComputeTargetAssignment> find(UUID taskId, UUID attemptId) {
    return Optional.ofNullable(mapper.find(taskId, attemptId));
  }
}
