package com.narrativex.backend.feature.assets.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository.CreateUploadSession;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository.UploadSession;
import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort.StoredObject;
import com.narrativex.backend.feature.assets.application.query.UploadFinalizeView;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import javax.sql.DataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class MediaUploadFinalizationConcurrencyIntegrationTest {
  private static final String ACCOUNT = "finalize-concurrency-account";
  private static final String SHA = "c".repeat(64);

  @Container
  static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:17-alpine")
          .withDatabaseName("narrativex_media_upload_concurrency_test")
          .withUsername("narrativex")
          .withPassword("narrativex");

  @DynamicPropertySource
  static void postgresProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    registry.add("spring.flyway.enabled", () -> true);
    registry.add("spring.flyway.baseline-on-migrate", () -> false);
    registry.add("spring.data.redis.repositories.enabled", () -> false);
  }

  @Autowired private MediaUploadSessionRepository sessions;
  @Autowired private MediaUploadFinalizationService finalization;
  @Autowired private DataSource dataSource;

  @BeforeEach
  @AfterEach
  void cleanRows() {
    JdbcTemplate jdbc = new JdbcTemplate(dataSource);
    jdbc.update("DELETE FROM media_storage_cleanup_tasks");
    jdbc.update("DELETE FROM media_upload_sessions WHERE account_id = ?", ACCOUNT);
    jdbc.update("DELETE FROM media_validation_jobs WHERE account_id = ?", ACCOUNT);
    jdbc.update("DELETE FROM media_asset_checksums WHERE account_id = ?", ACCOUNT);
    jdbc.update("DELETE FROM media_assets WHERE account_id = ?", ACCOUNT);
  }

  @Test
  void concurrentFinalizeUsesOneCanonicalReadyAssetAndNoOrphan() throws Exception {
    UploadSession session = createSession();
    StoredObject storedObject = storedObject(session);
    CyclicBarrier start = new CyclicBarrier(3);
    ExecutorService executor = Executors.newFixedThreadPool(2);
    try {
      List<Future<UploadFinalizeView>> results =
          List.of(
              executor.submit(() -> finalizeAfter(start, session.id(), storedObject)),
              executor.submit(() -> finalizeAfter(start, session.id(), storedObject)));
      start.await();

      UploadFinalizeView first = results.get(0).get();
      UploadFinalizeView second = results.get(1).get();

      assertThat(first.status()).isEqualTo("VALIDATING");
      assertThat(second.status()).isEqualTo("VALIDATING");
      assertThat(second.mediaAssetId()).isEqualTo(first.mediaAssetId());
      assertThat(count("SELECT COUNT(*) FROM media_upload_sessions WHERE id = ? AND status = 'VALIDATING'", session.id()))
          .isEqualTo(1);
      assertThat(count("SELECT COUNT(*) FROM media_assets WHERE account_id = ? AND status = 'VALIDATING'", ACCOUNT))
          .isEqualTo(1);
      assertThat(
              count(
                  "SELECT COUNT(*) FROM media_assets WHERE account_id = ? AND status IN ('PENDING_UPLOAD', 'UPLOADING')",
                  ACCOUNT))
          .isZero();
    } finally {
      executor.shutdownNow();
    }
  }

  @Test
  void retryReturnsSameMediaAssetWithoutCreatingAnotherAsset() {
    UploadSession session = createSession();
    StoredObject storedObject = storedObject(session);

    UploadFinalizeView first = finalization.finalizeVerifiedObject(ACCOUNT, session.id(), storedObject);
    UploadFinalizeView retry = finalization.finalizeVerifiedObject(ACCOUNT, session.id(), storedObject);

    assertThat(retry.mediaAssetId()).isEqualTo(first.mediaAssetId());
    assertThat(count("SELECT COUNT(*) FROM media_assets WHERE account_id = ?", ACCOUNT)).isEqualTo(1);
    assertThat(count("SELECT COUNT(*) FROM media_storage_cleanup_tasks")).isZero();
  }

  @Test
  void concurrentFinalizeForDifferentObjectsClaimsOneCanonicalAsset() throws Exception {
    UploadSession firstSession = createSession();
    UploadSession secondSession = createSession();
    CyclicBarrier start = new CyclicBarrier(3);
    ExecutorService executor = Executors.newFixedThreadPool(2);
    try {
      List<Future<UploadFinalizeView>> results =
          List.of(
              executor.submit(
                  () -> finalizeAfter(start, firstSession.id(), storedObject(firstSession))),
              executor.submit(
                  () -> finalizeAfter(start, secondSession.id(), storedObject(secondSession))));
      start.await();

      UploadFinalizeView first = results.get(0).get();
      UploadFinalizeView second = results.get(1).get();

      assertThat(first.mediaAssetId()).isEqualTo(second.mediaAssetId());
      assertThat(count("SELECT COUNT(*) FROM media_asset_checksums WHERE account_id = ?", ACCOUNT))
          .isEqualTo(1);
      assertThat(count("SELECT COUNT(*) FROM media_assets WHERE account_id = ?", ACCOUNT))
          .isEqualTo(1);
      assertThat(
              count(
                  "SELECT COUNT(*) FROM media_upload_sessions WHERE account_id = ? AND status = 'VALIDATING'",
                  ACCOUNT))
          .isEqualTo(2);
      assertThat(
              count(
                  "SELECT COUNT(*) FROM media_storage_cleanup_tasks WHERE reason = 'DUPLICATE_UPLOAD'"))
          .isEqualTo(1);
    } finally {
      executor.shutdownNow();
    }
  }

  @Test
  void rejectedFinalizationCommitsDurableCleanupTask() {
    UploadSession session = createSession();

    UploadFinalizeView result =
        finalization.finalizeVerifiedObject(
            ACCOUNT,
            session.id(),
            new StoredObject(session.storageKey(), session.expectedSize() + 1, session.contentType(), SHA));

    assertThat(result.status()).isEqualTo("REJECTED");
    assertThat(count("SELECT COUNT(*) FROM media_storage_cleanup_tasks WHERE status = 'PENDING'"))
        .isEqualTo(1);
    assertThat(
            count(
                "SELECT COUNT(*) FROM media_storage_cleanup_tasks WHERE storage_key = ? AND reason = 'UPLOAD_VERIFICATION_FAILED'",
                session.storageKey()))
        .isEqualTo(1);
  }

  private UploadFinalizeView finalizeAfter(
      CyclicBarrier start, UUID sessionId, StoredObject storedObject) throws Exception {
    start.await();
    return finalization.finalizeVerifiedObject(ACCOUNT, sessionId, storedObject);
  }

  private UploadSession createSession() {
    UUID id = UUID.randomUUID();
    return sessions.create(
        new CreateUploadSession(
            id,
            ACCOUNT,
            "AUDIO",
            "voice.wav",
            "audio/wav",
            128,
            SHA,
            "media/uploads/" + id,
            null,
            Instant.now().plusSeconds(900)));
  }

  private static StoredObject storedObject(UploadSession session) {
    return new StoredObject(session.storageKey(), session.expectedSize(), session.contentType(), SHA);
  }

  private long count(String sql, Object... args) {
    return new JdbcTemplate(dataSource).queryForObject(sql, Long.class, args);
  }
}
