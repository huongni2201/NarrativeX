package com.narrativex.backend.feature.storyboard.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.narrativex.backend.support.PostgreSqlIntegrationTestSupport;
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
            + " VALUES (1003, 'P1003', 'Desc', 'seed-user-01', 'ACTIVE', 'vi-VN', 'vi-VN',"
            + " 'vi-VN', 'RATIO_16_9', 'STANDARD') ON CONFLICT (id) DO NOTHING");
  }

  @Test
  void createsStoryVersionAndChapterInOneIdempotentApiWorkflow() throws Exception {
    String request =
        "{\"title\":\"Chapter 1\",\"sourceText\":\"Once upon a time\","
            + "\"storyVersionId\":null}";

    mockMvc
        .perform(
            post("/api/v1/projects/1003/chapters")
                .header("Idempotency-Key", "chapter-create-1003")
                .contentType(MediaType.APPLICATION_JSON)
                .content(request))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.id").isNumber())
        .andExpect(jsonPath("$.data.storyVersionId").isNumber())
        .andExpect(jsonPath("$.data.orderIndex").value(0));

    mockMvc
        .perform(
            post("/api/v1/projects/1003/chapters")
                .header("Idempotency-Key", "chapter-create-1003")
                .contentType(MediaType.APPLICATION_JSON)
                .content(request))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.id").isNumber());

    org.assertj.core.api.Assertions.assertThat(
            jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM story_versions WHERE project_id = 1003", Integer.class))
        .isEqualTo(1);
    org.assertj.core.api.Assertions.assertThat(
            jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM chapters c JOIN story_versions sv ON sv.id ="
                    + " c.story_version_id WHERE sv.project_id = 1003",
                Integer.class))
        .isEqualTo(1);
  }
}
