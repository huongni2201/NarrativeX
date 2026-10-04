package com.narrativex.backend.feature.generation.infrastructure.compute.node;

import com.narrativex.backend.feature.generation.application.model.compute.ComputeTargetAssignment;
import com.narrativex.backend.feature.generation.application.port.out.ComputeTargetAssignmentStore;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
@RequiredArgsConstructor
public class JdbcComputeTargetAssignmentStore implements ComputeTargetAssignmentStore {
  private final JdbcTemplate jdbcTemplate;

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
    jdbcTemplate.update(
        "INSERT INTO compute_target_assignments(task_id, attempt_id, executor, target_id) "
            + "VALUES (?, ?, ?, ?) ON CONFLICT (task_id, attempt_id) DO NOTHING",
        taskId,
        attemptId,
        executor,
        proposedTargetId);
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
    List<ComputeTargetAssignment> rows =
        jdbcTemplate.query(
            "SELECT task_id, attempt_id, executor, target_id "
                + "FROM compute_target_assignments WHERE task_id = ? AND attempt_id = ?",
            (result, rowNumber) ->
                new ComputeTargetAssignment(
                    result.getObject("task_id", UUID.class),
                    result.getObject("attempt_id", UUID.class),
                    result.getString("executor"),
                    result.getString("target_id")),
            taskId,
            attemptId);
    return rows.stream().findFirst();
  }
}
