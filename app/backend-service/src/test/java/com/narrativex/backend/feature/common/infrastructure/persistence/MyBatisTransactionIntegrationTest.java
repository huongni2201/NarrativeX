package com.narrativex.backend.feature.common.infrastructure.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.port.out.ProviderOperationRepository;
import com.narrativex.backend.feature.generation.domain.entity.ProviderOperation;
import com.narrativex.backend.feature.project.application.port.out.ProjectRepository;
import com.narrativex.backend.feature.project.application.port.out.StoryVersionRepository;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import com.narrativex.backend.feature.project.domain.enums.AspectRatio;
import com.narrativex.backend.support.PostgreSqlIntegrationTestSupport;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest
@ActiveProfiles("test")
class MyBatisTransactionIntegrationTest extends PostgreSqlIntegrationTestSupport {
  @Autowired private ProjectRepository projectRepository;
  @Autowired private StoryVersionRepository storyVersionRepository;
  @Autowired private ProviderOperationRepository providerOperationRepository;
  @Autowired private JdbcTemplate jdbcTemplate;
  @Autowired private PlatformTransactionManager transactionManager;

  @Test
  void allMyBatisWritesRollbackTogetherWhenProviderComesAfter() {
    assertBothWritesRollback(false);
  }

  @Test
  void allMyBatisWritesRollbackTogetherWhenProviderComesFirst() {
    assertBothWritesRollback(true);
  }

  private void assertBothWritesRollback(boolean providerFirst) {
    UUID stageAttemptId = insertStageAttempt();
    String fingerprint = "a".repeat(32) + UuidV7.random().toString().replace("-", "");
    UUID[] projectId = new UUID[1];
    assertThrows(
        ForcedRollback.class,
        () ->
            new TransactionTemplate(transactionManager)
                .executeWithoutResult(
                    ignored -> {
                      if (providerFirst)
                        providerOperationRepository.save(
                            ProviderOperation.create(stageAttemptId, "vertex", fingerprint));
                      Project project = projectRepository.save(newProject());
                      projectId[0] = project.getId();
                      storyVersionRepository.save(
                          StoryVersion.create(project.getId(), 1, "transaction story", "en-US"));
                      if (!providerFirst)
                        providerOperationRepository.save(
                            ProviderOperation.create(stageAttemptId, "vertex", fingerprint));
                      throw new ForcedRollback();
                    }));
    assertEquals(
        0,
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM projects WHERE id = ?", Integer.class, projectId[0]));
    assertEquals(
        0,
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM provider_operations WHERE request_fingerprint = ?",
            Integer.class,
            fingerprint));
    assertEquals(
        0,
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM story_versions WHERE project_id = ?",
            Integer.class,
            projectId[0]));
  }

  private Project newProject() {
    return Project.create(
        "transaction-test-" + UuidV7.random(),
        "transaction-test",
        "en-US",
        "en-US",
        "en-US",
        AspectRatio.RATIO_16_9);
  }

  private UUID insertStageAttempt() {
    UUID projectId =
        jdbcTemplate.queryForObject(
            "INSERT INTO projects (name, owner_id, status, source_language, narration_language, metadata_language, image_aspect_ratio) VALUES (?, 'transaction-fixture', 'DRAFT', 'en-US', 'en-US', 'en-US', 'RATIO_16_9') RETURNING id",
            UUID.class,
            "fixture-" + UuidV7.random());
    UUID jobId =
        jdbcTemplate.queryForObject(
            "INSERT INTO generation_jobs (job_id, project_id, job_type, status, resource_class, progress, requested_by_user_id, billed_to_user_id) VALUES (?, ?, 'CHAPTER_ANALYZE', 'QUEUED', 'PROVIDER_INTERACTIVE', 0, 'transaction-fixture', 'transaction-fixture') RETURNING id",
            UUID.class,
            UuidV7.random(),
            projectId);
    return jdbcTemplate.queryForObject(
        "INSERT INTO stage_attempts (generation_job_id, stage_name, attempt_number, status) VALUES (?, ?, 1, 'QUEUED') RETURNING id",
        UUID.class,
        jobId,
        "transaction-stage-" + UuidV7.random());
  }

  private static final class ForcedRollback extends RuntimeException {}
}
