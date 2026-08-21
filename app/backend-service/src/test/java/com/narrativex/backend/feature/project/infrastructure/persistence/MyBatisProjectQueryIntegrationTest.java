package com.narrativex.backend.feature.project.infrastructure.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.project.application.port.out.ProjectOverviewQueryRepository;
import com.narrativex.backend.feature.project.application.port.out.ProjectRepository;
import com.narrativex.backend.feature.project.application.port.out.ProjectResourceQueryRepository;
import com.narrativex.backend.feature.project.application.query.ProjectOverviewView;
import com.narrativex.backend.feature.project.application.query.ProjectResourceView;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.project.domain.enums.AspectRatio;
import com.narrativex.backend.feature.project.domain.enums.ImageQualityTier;
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
          (project_id, version_number, content, source_language, status, moderation_decision)
        VALUES (?, 1, 'Overview story', 'vi-VN', 'DRAFT', 'PENDING')
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
    var rows = dashboardMapper.findDashboardPage("seed-user-01", null, null, "NEWEST", 0, 21);
    var counts = dashboardMapper.findDashboardCounts("seed-user-01", null);

    assertEquals(10, rows.size());
    assertEquals(1010L, rows.getFirst().id());
    assertEquals("ACTIVE", rows.getFirst().status());
    assertEquals(1, rows.getFirst().totalChapters());
    assertEquals(1, rows.getFirst().totalScenes());
    assertEquals(47L, rows.getFirst().estimatedDurationSeconds());
    assertEquals(10L, counts.allCount());
    assertEquals(7L, counts.activeCount());
    assertEquals(2L, counts.draftCount());
  }

  private Project newProject() {
    return Project.create(
        "Query project " + UUID.randomUUID(),
        "query-owner",
        "vi-VN",
        "vi-VN",
        "vi-VN",
        AspectRatio.RATIO_16_9,
        ImageQualityTier.STANDARD);
  }
}
