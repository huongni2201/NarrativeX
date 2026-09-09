package com.narrativex.backend.feature.project.infrastructure.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.project.application.port.out.ProjectOverviewQueryRepository;
import com.narrativex.backend.feature.project.application.port.out.ProjectRepository;
import com.narrativex.backend.feature.project.application.port.out.ProjectResourceQueryRepository;
import com.narrativex.backend.feature.project.application.query.ProjectOverviewView;
import com.narrativex.backend.feature.project.application.query.ProjectResourceView;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.project.domain.enums.AspectRatio;
import com.narrativex.backend.feature.project.infrastructure.persistence.mybatis.ProjectDashboardMapper;
import com.narrativex.backend.support.PostgreSqlIntegrationTestSupport;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("test")
@SpringBootTest
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class MyBatisProjectQueryIntegrationTest extends PostgreSqlIntegrationTestSupport {
  @Autowired private ProjectRepository projectRepository;
  @Autowired private ProjectOverviewQueryRepository overviewRepository;
  @Autowired private ProjectResourceQueryRepository resourceRepository;
  @Autowired private ProjectDashboardMapper dashboardMapper;
  @Autowired private JdbcTemplate jdbcTemplate;

  @Test
  void mapsOverviewFromProjectAndLatestStoryVersion() {
    Project project = projectRepository.save(newProject());
    jdbcTemplate.update(
        """
        INSERT INTO story_versions
          (project_id, version_number, content, source_language, status)
        VALUES (?, 1, 'Overview story', 'vi-VN', 'DRAFT')
        """,
        project.getId());

    ProjectOverviewView overview = overviewRepository.get(project.getId());
    assertEquals(project.getId(), overview.id());
    assertEquals("Overview story", overview.description());
    assertNotNull(overview.updatedAt());
    assertEquals(0, overview.metrics().totalChapters());
  }

  @Test
  void mapsAndPaginatesLocationsAndAssetsThroughMyBatis() {
    Project project = projectRepository.save(newProject());
    jdbcTemplate.update(
        "INSERT INTO project_locations (project_id, name, description, visual_prompt) VALUES (?, ?,"
            + " 'desc', 'prompt')",
        project.getId(),
        "Location " + UUID.randomUUID());
    jdbcTemplate.update(
        "INSERT INTO project_assets (project_id, name, asset_type, status, metadata_json) VALUES"
            + " (?, ?, 'AUDIO', 'ACTIVE', '{}'::jsonb)",
        project.getId(),
        "Asset " + UUID.randomUUID());

    CursorPage<ProjectResourceView.Location> locations =
        resourceRepository.listLocations(project.getId(), null, 10);
    CursorPage<ProjectResourceView.Asset> assets =
        resourceRepository.listAssets(project.getId(), null, 10);

    assertEquals(1, locations.content().size());
    assertEquals("ACTIVE", locations.content().getFirst().status());
    assertEquals(1, assets.content().size());
    assertEquals("{}", assets.content().getFirst().metadataJson());
  }

  @Test
  void mapsDashboardPageAndCountsForAuthenticatedOwner() {
    String ownerId = "dash-owner-" + UUID.randomUUID();
    Project p1 =
        projectRepository.save(
            Project.create("P1", ownerId, "vi-VN", "vi-VN", "vi-VN", AspectRatio.RATIO_16_9));
    Project p2 =
        projectRepository.save(
            Project.create("P2", ownerId, "vi-VN", "vi-VN", "vi-VN", AspectRatio.RATIO_16_9));

    jdbcTemplate.update(
        "UPDATE projects SET status = 'ACTIVE' WHERE id IN (?, ?)", p1.getId(), p2.getId());

    jdbcTemplate.update(
        "INSERT INTO story_versions (project_id, version_number, content, source_language, status) "
            + "VALUES (?, 1, 'Content', 'vi-VN', 'ACTIVE')",
        p1.getId());
    UUID storyVersionId =
        jdbcTemplate.queryForObject(
            "SELECT id FROM story_versions WHERE project_id = ?", UUID.class, p1.getId());
    jdbcTemplate.update(
        "INSERT INTO chapters (story_version_id, order_index, title, source_text, source_hash, status, estimated_duration_ms, generation_progress) "
            + "VALUES (?, 1, 'Ch 1', 'Text', repeat('a', 64), 'READY', 47000, 100)",
        storyVersionId);
    UUID chapterId =
        jdbcTemplate.queryForObject(
            "SELECT id FROM chapters WHERE story_version_id = ?", UUID.class, storyVersionId);
    jdbcTemplate.update(
        "INSERT INTO storyboard_revisions (chapter_id, revision_number, source_hash, source_row_version, status) "
            + "VALUES (?, 1, repeat('a', 64), 0, 'DRAFT')",
        chapterId);
    UUID revId =
        jdbcTemplate.queryForObject(
            "SELECT id FROM storyboard_revisions WHERE chapter_id = ?", UUID.class, chapterId);
    jdbcTemplate.update(
        "UPDATE chapters SET current_storyboard_revision_id = ? WHERE id = ?", revId, chapterId);
    jdbcTemplate.update(
        "INSERT INTO scenes (chapter_id, storyboard_revision_id, order_index, title, narration, duration_seconds, status) "
            + "VALUES (?, ?, 1, 'Scene 1', 'Narration', 47, 'APPROVED')",
        chapterId,
        revId);

    jdbcTemplate.update(
        "INSERT INTO auth_users (id, email, display_name, enabled) VALUES (?, ?, ?, true) ON CONFLICT (id) DO NOTHING",
        ownerId,
        ownerId + "@example.com",
        ownerId);
    jdbcTemplate.update(
        "INSERT INTO project_favorites (user_id, project_id) VALUES (?, ?)", ownerId, p1.getId());

    var rows = dashboardMapper.findDashboardPage(ownerId, null, null, "NEWEST", 0, 21);
    var counts = dashboardMapper.findDashboardCounts(ownerId, null);

    assertEquals(2, rows.size());
    assertEquals(p2.getId(), rows.getFirst().id());
    assertEquals(2L, counts.allCount());
    assertEquals(2L, counts.activeCount());
    assertEquals(0L, counts.draftCount());

    var starredRows = dashboardMapper.findDashboardPage(ownerId, null, null, "STARRED", 0, 21);
    assertEquals(2, starredRows.size());
    assertEquals(p1.getId(), starredRows.getFirst().id());
    assertTrue(starredRows.getFirst().starred());
    assertEquals(1, starredRows.getFirst().totalChapters());
    assertEquals(1, starredRows.getFirst().totalScenes());
    assertEquals(47L, starredRows.getFirst().estimatedDurationSeconds());
  }

  private Project newProject() {
    return Project.create(
        "Query project " + UUID.randomUUID(),
        "query-owner",
        "vi-VN",
        "vi-VN",
        "vi-VN",
        AspectRatio.RATIO_16_9);
  }
}
