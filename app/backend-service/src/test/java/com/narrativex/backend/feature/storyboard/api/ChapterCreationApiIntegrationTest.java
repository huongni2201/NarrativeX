package com.narrativex.backend.feature.storyboard.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;

import com.narrativex.backend.support.PostgreSqlIntegrationTestSupport;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ChapterCreationApiIntegrationTest extends PostgreSqlIntegrationTestSupport {
  private static final UUID PROJECT_ID = UUID.fromString("00000000-0000-4000-8000-000000001003");
  @DynamicPropertySource
  static void identityProperties(DynamicPropertyRegistry registry) {
    registry.add("narrativex.security.local-dev-identity-enabled", () -> true);
    registry.add("narrativex.security.local-user-id", () -> "seed-user-01");
  }

  @Autowired private MockMvc mockMvc;
  @Autowired private JdbcTemplate jdbcTemplate;

  @BeforeEach
  void seedProjectWithoutStoryVersion() {
    jdbcTemplate.update(
        "INSERT INTO auth_users (id, email, display_name, password_hash, enabled) VALUES"
            + " ('seed-user-01', 'chapter-create@example.com', 'Chapter Creator', 'pass', true)"
            + " ON CONFLICT (id) DO NOTHING");
    jdbcTemplate.update(
        "INSERT INTO projects (id, name, description, owner_id, status, source_language,"
            + " narration_language, metadata_language, image_aspect_ratio, image_quality_tier)"
            + " VALUES (?, 'P1003', 'Desc', 'seed-user-01', 'ACTIVE', 'vi-VN', 'vi-VN',"
            + " 'vi-VN', 'RATIO_16_9', 'STANDARD') ON CONFLICT (id) DO NOTHING",
        PROJECT_ID);
  }

  @Test
  void createsStoryVersionAndChapterInOneIdempotentApiWorkflow() throws Exception {
    String request =
        "{\"title\":\"Chapter 1\",\"sourceText\":\"Once upon a time\","
            + "\"storyVersionId\":null}";

    mockMvc
        .perform(
            post("/api/v1/projects/" + PROJECT_ID + "/chapters")
                .with(csrf())
                .header("Idempotency-Key", "chapter-create-1003")
                .contentType(MediaType.APPLICATION_JSON)
                .content(request))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.id").isString())
        .andExpect(jsonPath("$.data.storyVersionId").isString())
        .andExpect(jsonPath("$.data.orderIndex").value(0));

    mockMvc
        .perform(
            post("/api/v1/projects/" + PROJECT_ID + "/chapters")
                .with(csrf())
                .header("Idempotency-Key", "chapter-create-1003")
                .contentType(MediaType.APPLICATION_JSON)
                .content(request))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.id").isString());

    org.assertj.core.api.Assertions.assertThat(
            jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM story_versions WHERE project_id = ?", Integer.class, PROJECT_ID))
        .isEqualTo(1);
    org.assertj.core.api.Assertions.assertThat(
            jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM chapters c JOIN story_versions sv ON sv.id ="
                    + " c.story_version_id WHERE sv.project_id = ?",
                Integer.class,
                PROJECT_ID))
        .isEqualTo(1);
  }
}
