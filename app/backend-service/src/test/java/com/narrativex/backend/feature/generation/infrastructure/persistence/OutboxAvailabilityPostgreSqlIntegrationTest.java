package com.narrativex.backend.feature.generation.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.assets.application.port.out.MediaValidationJobRepository.ValidationRequest;
import com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis.MediaValidationJobMapper;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.GenerationOutboxMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.GenerationOutboxRow;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@Transactional
class OutboxAvailabilityPostgreSqlIntegrationTest {
  @Container
  static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:18-alpine")
          .withDatabaseName("narrativex_outbox_default_test")
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
    registry.add("spring.session.jdbc.initialize-schema", () -> "never");
  }

  @Autowired private GenerationOutboxMapper generationOutboxMapper;
  @Autowired private MediaValidationJobMapper mediaValidationJobMapper;
  @Autowired private JdbcTemplate jdbcTemplate;

  @Test
  void generationOutboxUsesDatabaseAvailabilityDefaultAndCanBeReserved() {
    UUID jobId = UUID.randomUUID();
    String eventKey = "generation-job:" + jobId + ":queued";
    GenerationOutboxRow row =
        new GenerationOutboxRow(
            jobId.toString(),
            eventKey,
            JobType.CHAPTER_GENERATE,
            UUID.randomUUID(),
            UUID.randomUUID(),
            UUID.randomUUID(),
            0L,
            "a".repeat(64),
            null,
            null,
            ProductionMode.IMAGE_MOTION);

    assertThat(generationOutboxMapper.enqueue(row)).isEqualTo(1);
    assertReadyNow(eventKey);
    assertThat(generationOutboxMapper.reserveBatch(5_000L)).hasSize(1);
  }

  @Test
  void mediaValidationOutboxUsesDatabaseAvailabilityDefaultAndCanBeReserved() {
    UUID mediaAssetId = UUID.randomUUID();
    String eventKey = "media-validation:" + mediaAssetId;
    ValidationRequest request =
        new ValidationRequest(
            mediaAssetId,
            "local/uploads/test.png",
            "IMAGE",
            "image/png",
            42L,
            "b".repeat(64));

    assertThat(mediaValidationJobMapper.insertOutbox(request)).isEqualTo(1);
    assertReadyNow(eventKey);
    assertThat(generationOutboxMapper.reserveBatch(5_000L)).hasSize(1);
  }

  private void assertReadyNow(String eventKey) {
    Boolean ready =
        jdbcTemplate.queryForObject(
            "SELECT available_at <= CURRENT_TIMESTAMP FROM outbox_events WHERE event_key = ?",
            Boolean.class,
            eventKey);
    assertThat(ready).isTrue();
  }
}
