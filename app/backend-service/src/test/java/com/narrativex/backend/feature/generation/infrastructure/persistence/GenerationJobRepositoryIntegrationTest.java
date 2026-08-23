package com.narrativex.backend.feature.generation.infrastructure.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import com.narrativex.backend.feature.generation.infrastructure.persistence.adapter.MyBatisGenerationJobPersistenceAdapter;
import com.narrativex.backend.support.PostgreSqlIntegrationTestSupport;
import java.math.BigDecimal;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest
@ActiveProfiles("test")
class GenerationJobRepositoryIntegrationTest extends PostgreSqlIntegrationTestSupport {
  @Autowired private GenerationJobRepository repository;
  @Autowired private JdbcTemplate jdbcTemplate;
  @Autowired private PlatformTransactionManager transactionManager;
  private ExecutorService executor;

  @AfterEach
  void tearDown() throws InterruptedException {
    if (executor != null) {
      executor.shutdownNow();
      assertTrue(executor.awaitTermination(5, TimeUnit.SECONDS));
    }
  }

  @Test
  void defaultPersistenceImplementationIsMyBatis() {
    assertInstanceOf(MyBatisGenerationJobPersistenceAdapter.class, repository);
  }

  @Test
  void insertsAndRoundTripsGeneratedIdentityAndOptionalFields() {
    long projectId = insertProject("owner-a");
    GenerationJob saved =
        repository.save(
            GenerationJob.create(
                projectId, JobType.STORY_ANALYZE, ResourceClass.CPU_LIGHT, "owner-a"));

    assertNotNull(saved.getId());
    assertEquals(0L, saved.getRowVersion());
    assertEquals(projectId, saved.getProjectId());
    assertEquals(JobStatus.QUEUED, saved.getStatus());
    assertNull(saved.getChapterId());
    assertNull(saved.getMediaPlanId());
  }

  @Test
  void updatesWithCompareAndSetAndRejectsStaleVersion() {
    long projectId = insertProject("owner-b");
    GenerationJob saved =
        repository.save(
            GenerationJob.create(
                projectId, JobType.STORY_ANALYZE, ResourceClass.CPU_LIGHT, "owner-b"));
    GenerationJob running = copyWithStatus(saved, JobStatus.RUNNING);

    GenerationJob updated = repository.save(running);

    assertEquals(1L, updated.getRowVersion());
    assertEquals(JobStatus.RUNNING, updated.getStatus());
    assertThrows(OptimisticLockingFailureException.class, () -> repository.save(running));
  }

  @Test
  void distinguishesMissingUpdateFromStaleVersion() {
    long projectId = insertProject("owner-c");
    GenerationJob missing =
        GenerationJob.rehydrate(
            999_999_999L,
            0L,
            UUID.randomUUID().toString(),
            projectId,
            JobType.STORY_ANALYZE,
            JobStatus.QUEUED,
            ResourceClass.CPU_LIGHT,
            0,
            "QUEUED",
            null,
            "owner-c",
            "owner-c",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null);

    assertThrows(ResourceNotFoundException.class, () -> repository.save(missing));
  }

  @Test
  void preservesOwnerIsolationAndArchivedProjectVisibility() {
    long projectId = insertProject("owner-d");
    GenerationJob saved =
        repository.save(
            GenerationJob.create(
                projectId, JobType.STORY_ANALYZE, ResourceClass.CPU_LIGHT, "owner-d"));

    assertTrue(repository.findByJobIdAndOwner(saved.getJobId(), "owner-d").isPresent());
    assertTrue(repository.findByJobIdAndOwner(saved.getJobId(), "other-owner").isEmpty());

    jdbcTemplate.update(
        "UPDATE projects SET archived_at = CURRENT_TIMESTAMP WHERE id = ?", projectId);
    assertTrue(repository.findByJobIdAndOwner(saved.getJobId(), "owner-d").isEmpty());
  }

  @Test
  void findsIdempotencyKeyAndDatabaseRejectsDuplicates() {
    long projectId = insertProject("owner-e");
    String key = "generation-job-" + UUID.randomUUID();
    GenerationJob first = repository.save(jobWithIdempotency(projectId, key, "owner-e"));

    assertEquals(first.getId(), repository.findByIdempotencyKey(key).orElseThrow().getId());
    assertThrows(
        DuplicateKeyException.class,
        () -> repository.save(jobWithIdempotency(projectId, key, "owner-e")));
  }

  @Test
  void mediaPlanPointerRoundTripsExactly() {
    long projectId = insertProject("owner-f");
    MediaFixture media = insertMediaPlan(projectId);
    GenerationJob job =
        GenerationJob.rehydrate(
            null,
            0L,
            UUID.randomUUID().toString(),
            projectId,
            JobType.CHAPTER_GENERATE,
            JobStatus.QUEUED,
            ResourceClass.CPU_RENDER,
            0,
            "QUEUED",
            null,
            "owner-f",
            "owner-f",
            media.storyVersionId(),
            media.chapterId(),
            null,
            0L,
            media.sourceHash(),
            null,
            "vi-VN",
            "media-job-" + UUID.randomUUID(),
            media.mediaPlanId(),
            1,
            ProductionMode.IMAGE_MOTION);

    GenerationJob saved = repository.save(job);

    assertEquals(media.mediaPlanId(), saved.getMediaPlanId());
    assertEquals(1, saved.getMediaPlanRevision());
    assertEquals(ProductionMode.IMAGE_MOTION, saved.getProductionMode());
  }

  @Test
  void advisoryLockSerializesTransactionsForSameIdempotencyKey() throws Exception {
    String key = "lock-" + UUID.randomUUID();
    CountDownLatch firstLocked = new CountDownLatch(1);
    CountDownLatch releaseFirst = new CountDownLatch(1);
    CountDownLatch secondAcquired = new CountDownLatch(1);
    executor = Executors.newFixedThreadPool(2);
    TransactionTemplate transactions = new TransactionTemplate(transactionManager);

    Future<?> first =
        executor.submit(
            () ->
                transactions.executeWithoutResult(
                    status -> {
                      repository.acquireIdempotencyLock(key);
                      firstLocked.countDown();
                      await(releaseFirst);
                    }));
    assertTrue(firstLocked.await(5, TimeUnit.SECONDS));

    Future<?> second =
        executor.submit(
            () ->
                transactions.executeWithoutResult(
                    status -> {
                      repository.acquireIdempotencyLock(key);
                      secondAcquired.countDown();
                    }));

    assertFalse(secondAcquired.await(250, TimeUnit.MILLISECONDS));
    releaseFirst.countDown();
    assertTrue(secondAcquired.await(5, TimeUnit.SECONDS));
    first.get(5, TimeUnit.SECONDS);
    second.get(5, TimeUnit.SECONDS);
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
        "Generation job test " + UUID.randomUUID(),
        ownerId);
  }

  private MediaFixture insertMediaPlan(long projectId) {
    long storyVersionId =
        jdbcTemplate.queryForObject(
            """
        INSERT INTO story_versions
          (project_id, version_number, content, source_language, status, moderation_decision)
        VALUES (?, 1, 'story', 'vi-VN', 'DRAFT', 'PENDING')
        RETURNING id
        """,
            Long.class,
            projectId);
    String sourceHash = "a".repeat(64);
    long chapterId =
        jdbcTemplate.queryForObject(
            """
        INSERT INTO chapters (story_version_id, order_index, title, source_text, source_hash)
        VALUES (?, 0, 'Chapter', 'source', ?)
        RETURNING id
        """,
            Long.class,
            storyVersionId,
            sourceHash);
    UUID mediaPlanId = UUID.randomUUID();
    jdbcTemplate.update(
        """
        INSERT INTO media_plans
          (id, chapter_id, chapter_row_version, source_hash, production_mode, revision,
           narration_characters, image_generate_count, image_edit_count, basic_motion_seconds,
           planned_i2v_seconds, estimated_cost, created_at)
        VALUES (?, ?, 0, ?, 'IMAGE_MOTION', 1, 0, 0, 0, 0, 0, ?, CURRENT_TIMESTAMP)
        """,
        mediaPlanId,
        chapterId,
        sourceHash,
        BigDecimal.ZERO);
    return new MediaFixture(storyVersionId, chapterId, sourceHash, mediaPlanId);
  }

  private static GenerationJob jobWithIdempotency(long projectId, String key, String userId) {
    return GenerationJob.rehydrate(
        null,
        0L,
        UUID.randomUUID().toString(),
        projectId,
        JobType.STORY_ANALYZE,
        JobStatus.QUEUED,
        ResourceClass.CPU_LIGHT,
        0,
        "QUEUED",
        null,
        userId,
        userId,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        key);
  }

  private static GenerationJob copyWithStatus(GenerationJob job, JobStatus status) {
    return GenerationJob.rehydrate(
        job.getId(),
        job.getRowVersion(),
        job.getJobId(),
        job.getProjectId(),
        job.getType(),
        status,
        job.getResourceClass(),
        job.getProgress(),
        job.getCurrentStep(),
        job.getErrorCode(),
        job.getRequestedByUserId(),
        job.getBilledToUserId(),
        job.getStoryVersionId(),
        job.getChapterId(),
        job.getStoryboardRevisionId(),
        job.getChapterRowVersion(),
        job.getSourceHash(),
        job.getSourceText(),
        job.getSourceLanguage(),
        job.getIdempotencyKey(),
        job.getMediaPlanId(),
        job.getMediaPlanRevision(),
        job.getProductionMode());
  }

  private static void await(CountDownLatch latch) {
    try {
      if (!latch.await(5, TimeUnit.SECONDS)) {
        throw new IllegalStateException("Timed out waiting for test barrier");
      }
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException(exception);
    }
  }

  private record MediaFixture(
      long storyVersionId, long chapterId, String sourceHash, UUID mediaPlanId) {}
}
