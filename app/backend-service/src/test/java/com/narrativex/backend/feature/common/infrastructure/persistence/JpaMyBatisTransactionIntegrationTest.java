package com.narrativex.backend.feature.common.infrastructure.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.narrativex.backend.feature.generation.application.port.out.ProviderOperationRepository;
import com.narrativex.backend.feature.generation.domain.entity.ProviderOperation;
import com.narrativex.backend.feature.project.application.port.out.ProjectRepository;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.project.domain.enums.AspectRatio;
import com.narrativex.backend.feature.project.domain.enums.ImageQualityTier;
import com.narrativex.backend.feature.project.domain.enums.ModerationDecision;
import com.narrativex.backend.feature.project.domain.enums.StoryVersionStatus;
import com.narrativex.backend.feature.project.infrastructure.persistence.entity.StoryVersionJpaEntity;
import com.narrativex.backend.support.PostgreSqlIntegrationTestSupport;
import jakarta.persistence.EntityManager;
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
class JpaMyBatisTransactionIntegrationTest extends PostgreSqlIntegrationTestSupport {
  @Autowired private ProjectRepository projectRepository;
  @Autowired private ProviderOperationRepository providerOperationRepository;
  @Autowired private JdbcTemplate jdbcTemplate;
  @Autowired private PlatformTransactionManager transactionManager;
  @Autowired private EntityManager entityManager;

  @Test
  void projectMyBatisAndStoryVersionJpaWritesRollbackTogetherWhenProviderComesAfter() {
    assertBothWritesRollback(false);
  }

  @Test
  void projectMyBatisAndStoryVersionJpaWritesRollbackTogetherWhenProviderComesFirst() {
    assertBothWritesRollback(true);
  }

  private void assertBothWritesRollback(boolean myBatisFirst) {
    long stageAttemptId = insertStageAttempt();
    String fingerprint = "transaction-" + UUID.randomUUID();
    long[] projectId = new long[1];

    assertThrows(
        ForcedRollback.class,
        () ->
            new TransactionTemplate(transactionManager)
                .executeWithoutResult(
                    ignored -> {
                      if (myBatisFirst) {
                        providerOperationRepository.save(
                            ProviderOperation.create(stageAttemptId, "vertex", fingerprint));
                      }
                      Project project = projectRepository.save(newProject());
                      projectId[0] = project.getId();
                      entityManager.persist(newStoryVersion(project.getId()));
                      entityManager.flush();
                      if (!myBatisFirst) {
                        providerOperationRepository.save(
                            ProviderOperation.create(stageAttemptId, "vertex", fingerprint));
                      }
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
        "transaction-test-" + UUID.randomUUID(),
        "transaction-test",
        "en-US",
        "en-US",
        "en-US",
        AspectRatio.RATIO_16_9,
        ImageQualityTier.STANDARD);
  }

  private StoryVersionJpaEntity newStoryVersion(long projectId) {
    return StoryVersionJpaEntity.builder()
        .projectId(projectId)
        .versionNumber(1)
        .content("transaction story")
        .sourceLanguage("en-US")
        .status(StoryVersionStatus.DRAFT)
        .moderationDecision(ModerationDecision.PENDING)
        .build();
  }

  private long insertStageAttempt() {
    long projectId =
        jdbcTemplate.queryForObject(
            """
            INSERT INTO projects
              (name, owner_id, status, source_language, narration_language, metadata_language,
               image_aspect_ratio, image_quality_tier)
            VALUES (?, 'transaction-fixture', 'DRAFT', 'en-US', 'en-US', 'en-US', 'RATIO_16_9', 'STANDARD')
            RETURNING id
            """,
            Long.class,
            "fixture-" + UUID.randomUUID());
    long jobId =
        jdbcTemplate.queryForObject(
            """
            INSERT INTO generation_jobs
              (job_id, project_id, job_type, status, resource_class, progress,
               requested_by_user_id, billed_to_user_id)
            VALUES (?, ?, 'CHAPTER_ANALYZE', 'QUEUED', 'PROVIDER_INTERACTIVE', 0,
                    'transaction-fixture', 'transaction-fixture')
            RETURNING id
            """,
            Long.class,
            UUID.randomUUID().toString(),
            projectId);
    return jdbcTemplate.queryForObject(
        """
        INSERT INTO stage_attempts (generation_job_id, stage_name, attempt_number, status)
        VALUES (?, ?, 1, 'QUEUED')
        RETURNING id
        """,
        Long.class,
        jobId,
        "transaction-stage-" + UUID.randomUUID());
  }

  private static final class ForcedRollback extends RuntimeException {}
}
