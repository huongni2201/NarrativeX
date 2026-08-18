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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest
@ActiveProfiles("test")
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

  @Test
  void legacySeedStoryVersionHydratesWithCurrentEnums() {
    EntityManager entityManager = entityManagerFactory.createEntityManager();
    try {
      StoryVersionJpaEntity storyVersion = entityManager.find(StoryVersionJpaEntity.class, 2001L);

      assertNotNull(storyVersion);
      assertEquals(StoryVersionStatus.ACTIVE, storyVersion.getStatus());
      assertEquals(ModerationDecision.SAFE, storyVersion.getModerationDecision());
    } finally {
      entityManager.close();
    }
  }

  @Test
  void archivedLegacyStoryVersionHydratesAsSupersededHistory() {
    EntityManager entityManager = entityManagerFactory.createEntityManager();
    try {
      StoryVersionJpaEntity storyVersion = entityManager.find(StoryVersionJpaEntity.class, 2007L);

      assertNotNull(storyVersion);
      assertEquals(StoryVersionStatus.SUPERSEDED, storyVersion.getStatus());
      assertEquals(ModerationDecision.SAFE, storyVersion.getModerationDecision());
    } finally {
      entityManager.close();
    }
  }
}
