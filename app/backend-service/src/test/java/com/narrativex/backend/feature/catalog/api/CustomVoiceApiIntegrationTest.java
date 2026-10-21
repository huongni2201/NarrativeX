package com.narrativex.backend.feature.catalog.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.narrativex.backend.feature.catalog.application.port.in.VoiceCatalogAccess;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
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
class CustomVoiceApiIntegrationTest {
  @Container
  static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:18-alpine")
          .withDatabaseName("narrativex_custom_voice_test")
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
  }

  @Autowired private MockMvc mockMvc;
  @Autowired private JdbcTemplate jdbcTemplate;
  @Autowired private VoiceCatalogAccess voiceCatalogAccess;

  @Test
  void seedsPresetsWithProviderVoiceNames() {
    var preset = voiceCatalogAccess.findVoice("vieneu-preset-minh-quan-pro").orElseThrow();

    assertEquals("Minh Quân Pro", preset.synthesisVoiceName());
    assertEquals(null, preset.referenceAssetId());
    assertTrue(voiceCatalogAccess.findVoice("vieneu-default").isEmpty());
  }

  @Test
  void createsListsAndRemovesCustomVoice() throws Exception {
    UUID referenceId = insertReference("1", "READY");

    String response =
        mockMvc
            .perform(
                post("/api/v1/voices/custom")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body("Giọng bà kể", referenceId)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.name").value("Giọng bà kể"))
            .andExpect(jsonPath("$.data.provider").value("VIENEU"))
            .andExpect(jsonPath("$.data.language").value("vi-VN"))
            .andReturn()
            .getResponse()
            .getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
    String voiceId = com.jayway.jsonpath.JsonPath.read(response, "$.data.id");

    var capabilities = voiceCatalogAccess.findVoice(voiceId).orElseThrow();
    assertEquals(referenceId, capabilities.referenceAssetId());
    assertTrue(capabilities.supportsVoiceClone());

    mockMvc
        .perform(get("/api/v1/voices?language=vi-VN"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.length()").value(26));

    mockMvc
        .perform(
            post("/api/v1/voices/custom")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("  giọng BÀ kể ", referenceId)))
        .andExpect(status().isConflict());

    mockMvc.perform(delete("/api/v1/voices/custom/" + voiceId)).andExpect(status().isOk());
    assertTrue(voiceCatalogAccess.findVoice(voiceId).isEmpty());
    mockMvc.perform(delete("/api/v1/voices/custom/" + voiceId)).andExpect(status().isNotFound());
  }

  @Test
  void rejectsPresetDeletionAndUnreadyReferences() throws Exception {
    mockMvc
        .perform(delete("/api/v1/voices/custom/vieneu-preset-minh-quan-pro"))
        .andExpect(status().isNotFound());
    assertTrue(voiceCatalogAccess.findVoice("vieneu-preset-minh-quan-pro").isPresent());

    UUID validating = insertReference("2", "VALIDATING");
    mockMvc
        .perform(
            post("/api/v1/voices/custom")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("Chưa sẵn sàng", validating)))
        .andExpect(status().isBadRequest());

    mockMvc
        .perform(
            post("/api/v1/voices/custom")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("Không có file", UuidV7.random())))
        .andExpect(status().isNotFound());

    mockMvc
        .perform(
            post("/api/v1/voices/custom")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"\",\"referenceAssetId\":\"" + validating + "\"}"))
        .andExpect(status().isBadRequest());
  }

  private UUID insertReference(String seed, String status) {
    UUID id = UuidV7.random();
    jdbcTemplate.update(
        "INSERT INTO voice_reference_assets (id, storage_key, original_filename, content_type,"
            + " size_bytes, sha256, status) VALUES (?, ?, 'ref.wav', 'audio/wav', 2048,"
            + " repeat(?, 64), ?)",
        id,
        "private/voice-references/" + id + ".wav",
        seed,
        status);
    return id;
  }

  private static String body(String name, UUID referenceId) {
    return "{\"name\":\""
        + name
        + "\",\"gender\":\"FEMALE\",\"referenceAssetId\":\""
        + referenceId
        + "\"}";
  }
}
