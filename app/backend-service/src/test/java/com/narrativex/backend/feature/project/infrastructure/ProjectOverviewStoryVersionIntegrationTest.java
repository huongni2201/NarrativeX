package com.narrativex.backend.feature.project.infrastructure;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.feature.project.infrastructure.persistence.adapter.JdbcProjectOverviewQueryAdapter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
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
class ProjectOverviewStoryVersionIntegrationTest {
  @Container
  static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:17-alpine")
          .withDatabaseName("narrativex_overview_test")
          .withUsername("narrativex")
          .withPassword("narrativex");

  @DynamicPropertySource
  static void postgresProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    registry.add("spring.jpa.database-platform", () -> "org.hibernate.dialect.PostgreSQLDialect");
    registry.add("spring.flyway.enabled", () -> true);
    registry.add("spring.flyway.baseline-on-migrate", () -> false);
    registry.add("spring.data.redis.repositories.enabled", () -> false);
  }

  @Autowired private JdbcTemplate jdbcTemplate;
  @Autowired private JdbcProjectOverviewQueryAdapter overviewQuery;

  @Test
  @Transactional
  void activeStoryVersionWinsOverNewerDraft() {
    jdbcTemplate.update(
        """
        INSERT INTO story_versions
          (id, project_id, version_number, content, source_language, status, moderation_decision)
        VALUES (990001, 1001, 2, 'New draft must not replace active overview', 'vi-VN', 'DRAFT', 'SAFE')
        """);
    jdbcTemplate.update(
        """
        INSERT INTO chapters
          (id, story_version_id, order_index, title, source_text, source_hash, status,
           estimated_duration_ms, generation_progress, source_story_version_id)
        VALUES
          (990001, 990001, 1, 'Draft V2 Chapter', 'draft source', repeat('a', 64), 'DRAFT',
           60000, 0, 990001)
        """);

    var overview = overviewQuery.get(1001L);

    assertTrue(overview.chapters().stream().anyMatch(chapter -> chapter.id().equals(3001L)));
    assertFalse(overview.chapters().stream().anyMatch(chapter -> chapter.id().equals(990001L)));
  }

  @Test
  void latestDraftIsUsedWhenProjectHasNoActiveStoryVersion() {
    var overview = overviewQuery.get(1004L);

    assertEquals(1, overview.chapters().size());
    assertEquals(3004L, overview.chapters().getFirst().id());
  }
}
