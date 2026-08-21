package com.narrativex.backend.feature.storyboard.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class StoryboardApiIntegrationTest {
  @Container
  static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:17-alpine")
          .withDatabaseName("narrativex_storyboard_api_test")
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
    registry.add("narrativex.security.local-dev-identity-enabled", () -> true);
    registry.add("narrativex.security.local-user-id", () -> "seed-user-01");
  }

  @Autowired private MockMvc mockMvc;
  @Autowired private JdbcTemplate jdbcTemplate;

  @Test
  void storyboardResponseContainsSplitMotionFieldsAndRenderableMetadata() throws Exception {
    mockMvc
        .perform(get("/api/v1/projects/1001/chapters/3001/storyboard"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.chapter.id").value(3001))
        .andExpect(jsonPath("$.data.scenes[0].visualBeats[0].title").value("Lanterns at dawn"))
        .andExpect(
            jsonPath("$.data.scenes[0].visualBeats[0].visualIntent")
                .value("Warm lanterns form a river of light through quiet stone streets."))
        .andExpect(jsonPath("$.data.scenes[0].visualBeats[0].motionMode").value("BASIC_MOTION"))
        .andExpect(jsonPath("$.data.scenes[0].visualBeats[0].cameraMovement").value("PAN"))
        .andExpect(jsonPath("$.data.scenes[0].visualBeats[0].reviewStatus").value("APPROVED"))
        .andExpect(jsonPath("$.data.scenes[0].visualBeats[0].rowVersion").isNumber());
  }

  @Test
  void chapterWorkspaceProjectsNarrationAndRenderStateFromDurableRows() throws Exception {
    jdbcTemplate.update("UPDATE visual_beats SET preview_asset_id = ? WHERE id = ?", 26001, 5001);

    mockMvc
        .perform(get("/api/v1/projects/1001/chapters/3001/workspace"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.pipeline.visualGeneration.status").value("NOT_STARTED"))
        .andExpect(jsonPath("$.data.pipeline.visualGeneration.total").value(0))
        .andExpect(jsonPath("$.data.pipeline.audio.status").value("READY"))
        .andExpect(jsonPath("$.data.pipeline.audio.completedAt").isNotEmpty())
        .andExpect(jsonPath("$.data.pipeline.render.status").value("COMPLETED"))
        .andExpect(jsonPath("$.data.pipeline.render.completedAt").isNotEmpty())
        .andExpect(
            jsonPath("$.data.previewScenes[0].previewImageUrl")
                .value("https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop"))
        .andExpect(jsonPath("$.data.capabilities.canGenerateVisuals").value(false))
        .andExpect(jsonPath("$.data.capabilities.canGenerateAudio").value(false))
        .andExpect(jsonPath("$.data.capabilities.canRender").value(false));

    mockMvc
        .perform(get("/api/v1/projects/1002/chapters/3002/workspace"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.pipeline.audio.status").value("NOT_STARTED"))
        .andExpect(jsonPath("$.data.pipeline.render.status").value("NOT_STARTED"));
  }

  @Test
  void catalogsAndArtifactMetadataComeFromPostgres() throws Exception {
    mockMvc
        .perform(get("/api/v1/style-presets?category=VISUAL_STYLE"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].name").value("Cinematic Warmth"))
        .andExpect(jsonPath("$.data[0].tags[0]").value("cinematic"));

    mockMvc
        .perform(get("/api/v1/voices?language=vi-VN"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.length()").value(2))
        .andExpect(jsonPath("$.data[0].language").value("vi-VN"));

    mockMvc
        .perform(get("/api/v1/assets?type=AUDIO"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.items[0].status").value("READY"))
        .andExpect(jsonPath("$.data.items[0].originalFilename").value("river-intro.wav"));

    mockMvc
        .perform(get("/api/v1/artifacts/28001/download"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.status").value("READY"))
        .andExpect(jsonPath("$.data.downloadAvailable").value(false))
        .andExpect(jsonPath("$.data.downloadUrl").doesNotExist());
  }
}
