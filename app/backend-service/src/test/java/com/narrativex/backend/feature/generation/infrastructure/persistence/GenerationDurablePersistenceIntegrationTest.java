package com.narrativex.backend.feature.generation.infrastructure.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationOutboxRepository;
import com.narrativex.backend.feature.generation.application.port.out.OperationPlanRepository;
import com.narrativex.backend.feature.generation.application.port.out.StageAttemptRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.aggregate.OperationPlan;
import com.narrativex.backend.feature.generation.domain.entity.StageAttempt;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import com.narrativex.backend.feature.generation.infrastructure.persistence.adapter.GenerationOutboxPersistenceAdapter;
import com.narrativex.backend.feature.generation.infrastructure.persistence.adapter.MyBatisGenerationJobPersistenceAdapter;
import com.narrativex.backend.feature.generation.infrastructure.persistence.adapter.OperationPlanPersistenceAdapter;
import com.narrativex.backend.feature.generation.infrastructure.persistence.adapter.StageAttemptPersistenceAdapter;
import com.narrativex.backend.support.PostgreSqlIntegrationTestSupport;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class GenerationDurablePersistenceIntegrationTest extends PostgreSqlIntegrationTestSupport {
  @Autowired private GenerationJobRepository generationJobRepository;
  @Autowired private OperationPlanRepository operationPlanRepository;
  @Autowired private StageAttemptRepository stageAttemptRepository;
  @Autowired private GenerationOutboxRepository generationOutboxRepository;
  @Autowired private JdbcTemplate jdbcTemplate;

  @Test
  void generationDurableBoundariesUseMyBatisAndPersistTogether() {
    assertInstanceOf(MyBatisGenerationJobPersistenceAdapter.class, generationJobRepository);
    assertInstanceOf(OperationPlanPersistenceAdapter.class, operationPlanRepository);
    assertInstanceOf(StageAttemptPersistenceAdapter.class, stageAttemptRepository);
    assertInstanceOf(GenerationOutboxPersistenceAdapter.class, generationOutboxRepository);

    long projectId = insertProject("generation-durable-owner");
    GenerationJob job =
        generationJobRepository.save(
            GenerationJob.create(
                projectId, JobType.STORY_ANALYZE, ResourceClass.CPU_LIGHT, "owner"));

    OperationPlan persistedPlan =
        operationPlanRepository.save(
            OperationPlan.create(
                projectId, "STORY_ANALYZE", BigDecimal.ONE, BigDecimal.TEN, BigDecimal.TEN));
    assertNotNull(persistedPlan.getId());
    OperationPlan boundPlan =
        operationPlanRepository.save(persistedPlan.withGenerationJobId(job.getId()));
    assertEquals(1L, boundPlan.getRowVersion());
    assertThrows(
        ObjectOptimisticLockingFailureException.class,
        () -> operationPlanRepository.save(persistedPlan.withGenerationJobId(job.getId())));

    StageAttempt attempt =
        stageAttemptRepository.create(StageAttempt.create(job.getId(), "ANALYSIS", 1));
    assertNotNull(attempt.getId());
    assertEquals(JobStatus.QUEUED, attempt.getStatus());

    generationOutboxRepository.enqueue(job);
    generationOutboxRepository.enqueue(job);
    assertEquals(
        1,
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM outbox_events WHERE event_key = ?",
            Integer.class,
            "generation-job:" + job.getJobId() + ":queued"));
  }

  private long insertProject(String ownerId) {
    return jdbcTemplate.queryForObject(
        """
        INSERT INTO projects
          (name, owner_id, status, source_language, narration_language, metadata_language,
           image_aspect_ratio, image_quality_tier)
        VALUES (?, ?, 'DRAFT', 'vi-VN', 'vi-VN', 'vi-VN', 'RATIO_16_9', 'STANDARD')
        RETURNING id
        """,
        Long.class,
        "Generation durable test " + UUID.randomUUID(),
        ownerId);
  }
}
