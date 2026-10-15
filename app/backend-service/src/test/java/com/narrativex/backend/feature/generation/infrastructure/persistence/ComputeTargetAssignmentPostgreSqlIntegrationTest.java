package com.narrativex.backend.feature.generation.infrastructure.persistence;

import static org.assertj.core.api.Assertions.*;

import com.narrativex.backend.feature.generation.application.port.out.ComputeTargetAssignmentStore;
import com.narrativex.backend.support.PostgreSqlIntegrationTestSupport;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest
@ActiveProfiles("test")
class ComputeTargetAssignmentPostgreSqlIntegrationTest extends PostgreSqlIntegrationTestSupport {
  @Autowired ComputeTargetAssignmentStore assignments;
  @Autowired TransactionTemplate transactions;

  @Test
  void targetAssignmentReplayKeepsFirstTargetAndRejectsExecutorChange() {
    UUID taskId = UUID.randomUUID();
    UUID attemptId = UUID.randomUUID();
    var first = assignments.pin(taskId, attemptId, "ltx", "worker-a");
    assertThat(assignments.pin(taskId, attemptId, "ltx", "worker-b")).isEqualTo(first);
    assertThatThrownBy(() -> assignments.pin(taskId, attemptId, "whisperx", "worker-b"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("different executor");
    assertThat(assignments.find(taskId, attemptId)).contains(first);

    UUID rolledBackAttempt = UUID.randomUUID();
    assertThatThrownBy(
            () ->
                transactions.executeWithoutResult(
                    status -> {
                      assignments.pin(taskId, rolledBackAttempt, "ltx", "worker-a");
                      throw new IllegalStateException("rollback");
                    }))
        .isInstanceOf(IllegalStateException.class);
    assertThat(assignments.find(taskId, rolledBackAttempt)).isEmpty();
    assertThat(assignments.find(taskId, UUID.randomUUID())).isEmpty();
  }
}
