package com.narrativex.backend.feature.generation.infrastructure.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.feature.generation.application.port.out.ProviderOperationRepository;
import com.narrativex.backend.feature.generation.domain.entity.ProviderOperation;
import com.narrativex.backend.feature.generation.domain.enums.ProviderOperationStatus;
import com.narrativex.backend.feature.generation.domain.exception.InvalidProviderOperationTransitionException;
import com.narrativex.backend.feature.generation.domain.exception.ProviderOperationResultConflictException;
import com.narrativex.backend.support.PostgreSqlIntegrationTestSupport;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class ProviderOperationRepositoryIntegrationTest extends PostgreSqlIntegrationTestSupport {
  private static final String RESULT_FINGERPRINT_A =
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  private static final String RESULT_FINGERPRINT_B =
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

  @Autowired private ProviderOperationRepository repository;
  @Autowired private JdbcTemplate jdbcTemplate;
  private ExecutorService executor;

  @AfterEach
  void tearDown() throws InterruptedException {
    if (executor != null) {
      executor.shutdownNow();
      assertTrue(executor.awaitTermination(5, TimeUnit.SECONDS));
    }
  }

  @Test
  void reservesDuplicateFingerprintIdempotently() {
    UUID stageAttemptId = insertStageAttempt();
    String fingerprint = uniqueSha();

    ProviderOperation first =
        repository.save(ProviderOperation.create(stageAttemptId, "vertex", fingerprint));
    ProviderOperation duplicate =
        repository.save(ProviderOperation.create(stageAttemptId, "vertex", fingerprint));

    assertEquals(first.getId(), duplicate.getId());
    assertEquals(ProviderOperationStatus.RESERVED, duplicate.getStatus());
  }

  @Test
  void persistsCanonicalLifecycleAndTreatsTerminalStateAsTerminal() {
    ProviderOperation reserved = reserve("lifecycle");
    ProviderOperation unknown =
        repository.markSubmissionUnknown(
            reserved.getId(), reserved.getRowVersion(), Instant.now().plusSeconds(30));
    ProviderOperation submitted =
        repository.transition(
            unknown.getId(),
            unknown.getRowVersion(),
            ProviderOperationStatus.SUBMITTED,
            "provider-1");
    ProviderOperation running =
        repository.transition(
            submitted.getId(), submitted.getRowVersion(), ProviderOperationStatus.RUNNING, null);
    ProviderOperation completed =
        repository.persistResult(
            running.getId(),
            running.getRowVersion(),
            null,
            "{\"answer\":\"ok\"}",
            RESULT_FINGERPRINT_A);

    assertEquals(ProviderOperationStatus.COMPLETED, completed.getStatus());
    assertThrows(
        InvalidProviderOperationTransitionException.class,
        () ->
            repository.transition(
                completed.getId(),
                completed.getRowVersion(),
                ProviderOperationStatus.RUNNING,
                null));
  }

  @Test
  void sameCompletedResultIsIdempotentButDifferentResultIsRejected() {
    ProviderOperation completed = complete(reserve("result"));

    ProviderOperation repeated =
        repository.persistResult(
            completed.getId(),
            completed.getRowVersion() - 1,
            null,
            "{\"answer\":\"ok\"}",
            RESULT_FINGERPRINT_A);

    assertEquals(completed.getId(), repeated.getId());
    assertThrows(
        ProviderOperationResultConflictException.class,
        () ->
            repository.persistResult(
                completed.getId(),
                completed.getRowVersion(),
                null,
                "{\"answer\":\"different\"}",
                RESULT_FINGERPRINT_B));
  }

  @Test
  void staleConcurrentTransitionsAllowOnlyOneWinner() throws Exception {
    ProviderOperation unknown =
        repository.markSubmissionUnknown(
            reserve("concurrency").getId(), 0L, Instant.now().plusSeconds(30));
    ProviderOperation snapshotA = repository.findById(unknown.getId()).orElseThrow();
    ProviderOperation snapshotB = repository.findById(unknown.getId()).orElseThrow();
    CountDownLatch ready = new CountDownLatch(2);
    CountDownLatch start = new CountDownLatch(1);
    executor = Executors.newFixedThreadPool(2);

    Future<Object> first =
        executor.submit(
            () ->
                transitionAfterBarrier(snapshotA, ProviderOperationStatus.SUBMITTED, ready, start));
    Future<Object> second =
        executor.submit(
            () -> transitionAfterBarrier(snapshotB, ProviderOperationStatus.RUNNING, ready, start));
    assertTrue(ready.await(5, TimeUnit.SECONDS));
    start.countDown();

    Object firstResult = first.get(10, TimeUnit.SECONDS);
    Object secondResult = second.get(10, TimeUnit.SECONDS);
    List<Object> results = List.of(firstResult, secondResult);

    assertEquals(1, results.stream().filter(ProviderOperation.class::isInstance).count());
    assertEquals(
        1, results.stream().filter(OptimisticLockingFailureException.class::isInstance).count());
    assertEquals(
        1,
        Stream.of(ProviderOperationStatus.SUBMITTED, ProviderOperationStatus.RUNNING)
            .filter(
                status -> repository.findById(unknown.getId()).orElseThrow().getStatus() == status)
            .count());
  }

  @Test
  void listsDueReconciliationOperations() {
    ProviderOperation operation =
        repository.markSubmissionUnknown(
            reserve("reconcile").getId(), 0L, Instant.now().minusSeconds(1));
    jdbcTemplate.update(
        "UPDATE stage_attempts SET status = 'UNKNOWN' WHERE id = ?", operation.getStageAttemptId());

    List<ProviderOperation> due =
        repository.findDueForReconciliation(
            List.of(ProviderOperationStatus.UNKNOWN, ProviderOperationStatus.RUNNING), 10);

    assertTrue(due.stream().anyMatch(candidate -> candidate.getId().equals(operation.getId())));
  }

  @Test
  void defaultPersistenceImplementationIsMyBatis() {
    assertInstanceOf(
        com.narrativex.backend.feature.generation.infrastructure.persistence.adapter
            .MyBatisProviderOperationPersistenceAdapter.class,
        repository);
  }

  private ProviderOperation reserve(String suffix) {
    return repository.save(ProviderOperation.create(insertStageAttempt(), "vertex", uniqueSha()));
  }

  private ProviderOperation complete(ProviderOperation reserved) {
    ProviderOperation unknown =
        repository.markSubmissionUnknown(
            reserved.getId(), reserved.getRowVersion(), Instant.now().plusSeconds(30));
    return repository.persistResult(
        unknown.getId(),
        unknown.getRowVersion(),
        "provider-result",
        "{\"ok\":true}",
        RESULT_FINGERPRINT_A);
  }

  private Object transitionAfterBarrier(
      ProviderOperation snapshot,
      ProviderOperationStatus nextStatus,
      CountDownLatch ready,
      CountDownLatch start)
      throws InterruptedException {
    ready.countDown();
    start.await(5, TimeUnit.SECONDS);
    try {
      return repository.transition(snapshot.getId(), snapshot.getRowVersion(), nextStatus, null);
    } catch (OptimisticLockingFailureException exception) {
      return exception;
    }
  }

  private UUID insertStageAttempt() {
    UUID projectId =
        jdbcTemplate.queryForObject(
            """
            INSERT INTO projects
              (name, owner_id, status, source_language, narration_language, metadata_language,
               image_aspect_ratio, image_quality_tier)
            VALUES (?, 'provider-operation-test', 'DRAFT', 'en-US', 'en-US', 'en-US', 'RATIO_16_9', 'STANDARD')
            RETURNING id
            """,
            UUID.class,
            "project-" + com.narrativex.backend.feature.common.uuid.UuidV7.random());
    UUID jobId =
        jdbcTemplate.queryForObject(
            """
            INSERT INTO generation_jobs
              (job_id, project_id, job_type, status, resource_class, progress,
               requested_by_user_id, billed_to_user_id)
            VALUES (?, ?, 'CHAPTER_ANALYZE', 'QUEUED', 'PROVIDER_INTERACTIVE', 0,
                    'provider-operation-test', 'provider-operation-test')
            RETURNING id
            """,
            UUID.class,
            com.narrativex.backend.feature.common.uuid.UuidV7.random(),
            projectId);
    return jdbcTemplate.queryForObject(
        """
        INSERT INTO stage_attempts (generation_job_id, stage_name, attempt_number, status)
        VALUES (?, ?, 1, 'QUEUED')
        RETURNING id
        """,
        UUID.class,
        jobId,
        "stage-" + com.narrativex.backend.feature.common.uuid.UuidV7.random());
  }

  private static String uniqueSha() {
    return "a".repeat(32)
        + com.narrativex.backend.feature.common.uuid.UuidV7.random().toString().replace("-", "");
  }
}
