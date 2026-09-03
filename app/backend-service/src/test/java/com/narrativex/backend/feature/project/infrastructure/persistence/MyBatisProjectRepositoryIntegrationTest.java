package com.narrativex.backend.feature.project.infrastructure.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.project.application.port.out.ProjectRepository;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.project.domain.enums.AspectRatio;
import com.narrativex.backend.feature.project.domain.enums.ProjectStatus;
import com.narrativex.backend.support.PostgreSqlIntegrationTestSupport;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("test")
@SpringBootTest
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class MyBatisProjectRepositoryIntegrationTest extends PostgreSqlIntegrationTestSupport {
  @Autowired private ProjectRepository repository;
  @Autowired private JdbcTemplate jdbcTemplate;

  @Test
  void savesReloadsUpdatesAndPreservesAuditTimestamps() {
    Project saved = repository.save(newProject("owner-a"));
    assertNotNull(saved.getId());

    Instant createdAt = timestamp("created_at", saved.getId());
    Instant updatedAt = timestamp("updated_at", saved.getId());
    assertNotNull(createdAt);
    assertNotNull(updatedAt);

    Project reloaded = repository.findOwnedById(saved.getId(), "owner-a").orElseThrow();
    assertEquals(saved.getId(), reloaded.getId());
    assertEquals("owner-a", reloaded.getOwnerId());
    assertEquals(ProjectStatus.DRAFT, reloaded.getStatus());

    reloaded.archive();
    Project archived = repository.save(reloaded);
    assertEquals(ProjectStatus.ARCHIVED, archived.getStatus());
    assertTrue(timestamp("updated_at", archived.getId()).compareTo(createdAt) >= 0);
    assertEquals(1L, archived.getRowVersion());
    assertTrue(repository.findOwnedById(archived.getId(), "owner-a").isEmpty());
  }

  @Test
  void rejectsStaleOptimisticUpdateInTheDatabase() {
    Project saved = repository.save(newProject("owner-b"));
    Project first = repository.findOwnedById(saved.getId(), "owner-b").orElseThrow();
    Project stale = repository.findOwnedById(saved.getId(), "owner-b").orElseThrow();

    first.archive();
    repository.save(first);

    stale.archive();
    assertThrows(OptimisticLockingFailureException.class, () -> repository.save(stale));
  }

  @Test
  void enforcesOwnerScopeAndStableCursorPagination() {
    String owner = "owner-" + UUID.randomUUID();
    repository.save(newProject(owner));
    repository.save(newProject(owner));
    repository.save(newProject(owner));

    CursorPage<Project> firstPage = repository.findActiveByOwnerId(owner, null, 2);
    assertEquals(2, firstPage.content().size());
    assertTrue(firstPage.hasNext());

    CursorPage<Project> secondPage =
        repository.findActiveByOwnerId(owner, firstPage.nextCursor(), 2);
    assertEquals(1, secondPage.content().size());
    assertEquals(
        0,
        firstPage.content().stream()
            .filter(first -> first.getId().equals(secondPage.content().getFirst().getId()))
            .count());

    assertTrue(repository.findOwnedById(firstPage.content().getFirst().getId(), "other").isEmpty());
  }

  private Project newProject(String ownerId) {
    return Project.create(
        "Project " + com.narrativex.backend.feature.common.uuid.UuidV7.random(),
        ownerId,
        "vi-VN",
        "vi-VN",
        "vi-VN",
        AspectRatio.RATIO_16_9);
  }

  private Instant timestamp(String column, UUID projectId) {
    return jdbcTemplate.queryForObject(
        "SELECT " + column + " FROM projects WHERE id = ?", Instant.class, projectId);
  }
}
