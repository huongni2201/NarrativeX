package com.narrativex.backend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.narrativex.backend.feature.project.domain.enums.ModerationDecision;
import com.narrativex.backend.feature.project.domain.enums.StoryVersionStatus;
import com.narrativex.backend.feature.project.infrastructure.persistence.entity.StoryVersionJpaEntity;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
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
class StoryVersionEnumMigrationIntegrationTest {
  @Container
  static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:17-alpine")
          .withDatabaseName("narrativex_story_version_enum_test")
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

  @Autowired private EntityManagerFactory entityManagerFactory;
  @Autowired private javax.sql.DataSource dataSource;

  private long createProject() throws Exception {
    try (var conn = dataSource.getConnection();
        var stmt = conn.prepareStatement(
            "insert into projects (name, owner_id, status, source_language, narration_language, metadata_language, image_aspect_ratio, image_quality_tier) "
                + "values ('Test Project', 'test-owner', 'ACTIVE', 'vi-VN', 'vi-VN', 'vi-VN', 'RATIO_16_9', 'STANDARD') returning id")) {
      try (var rs = stmt.executeQuery()) {
        rs.next();
        return rs.getLong(1);
      }
    }
  }

  @Test
  void legacySeedStoryVersionHydratesWithCurrentEnums() throws Exception {
    long projectId = createProject();
    EntityManager entityManager = entityManagerFactory.createEntityManager();
    try {
      entityManager.getTransaction().begin();
      StoryVersionJpaEntity entity = StoryVersionJpaEntity.builder()
          .projectId(projectId)
          .versionNumber(1)
          .content("Test story content")
          .sourceLanguage("vi-VN")
          .status(StoryVersionStatus.ACTIVE)
          .moderationDecision(ModerationDecision.SAFE)
          .build();
      entityManager.persist(entity);
      entityManager.getTransaction().commit();
      entityManager.clear();

      StoryVersionJpaEntity storyVersion = entityManager.find(StoryVersionJpaEntity.class, entity.getId());

      assertNotNull(storyVersion);
      assertEquals(StoryVersionStatus.ACTIVE, storyVersion.getStatus());
      assertEquals(ModerationDecision.SAFE, storyVersion.getModerationDecision());
    } finally {
      entityManager.close();
    }
  }

  @Test
  void archivedLegacyStoryVersionHydratesAsSupersededHistory() throws Exception {
    long projectId = createProject();
    EntityManager entityManager = entityManagerFactory.createEntityManager();
    try {
      entityManager.getTransaction().begin();
      StoryVersionJpaEntity entity = StoryVersionJpaEntity.builder()
          .projectId(projectId)
          .versionNumber(1)
          .content("Archived story content")
          .sourceLanguage("vi-VN")
          .status(StoryVersionStatus.SUPERSEDED)
          .moderationDecision(ModerationDecision.SAFE)
          .build();
      entityManager.persist(entity);
      entityManager.getTransaction().commit();
      entityManager.clear();

      StoryVersionJpaEntity storyVersion = entityManager.find(StoryVersionJpaEntity.class, entity.getId());

      assertNotNull(storyVersion);
      assertEquals(StoryVersionStatus.SUPERSEDED, storyVersion.getStatus());
      assertEquals(ModerationDecision.SAFE, storyVersion.getModerationDecision());
    } finally {
      entityManager.close();
    }
  }
}
