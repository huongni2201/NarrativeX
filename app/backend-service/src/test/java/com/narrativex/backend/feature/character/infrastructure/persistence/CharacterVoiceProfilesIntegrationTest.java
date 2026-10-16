package com.narrativex.backend.feature.character.infrastructure.persistence;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.narrativex.backend.feature.character.application.port.out.CharacterRepository;
import com.narrativex.backend.feature.character.application.port.out.CharacterVoiceProfileRepository;
import com.narrativex.backend.feature.character.application.service.SpeakerVoiceResolver;
import com.narrativex.backend.feature.character.domain.aggregate.Character;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class CharacterVoiceProfilesIntegrationTest {
  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:18-alpine");

  @DynamicPropertySource
  static void database(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    registry.add("spring.flyway.enabled", () -> true);
    registry.add("spring.flyway.baseline-on-migrate", () -> false);
  }

  @Autowired WebApplicationContext context;
  @Autowired CharacterRepository characters;
  @Autowired CharacterVoiceProfileRepository profiles;
  @Autowired SpeakerVoiceResolver resolver;
  @Autowired JdbcTemplate jdbc;
  private MockMvc mvc;
  private Character character;

  @BeforeEach
  void setUp() {
    mvc = MockMvcBuilders.webAppContextSetup(context).build();
    character = characters.save(Character.create("Voice fixture", List.of()));
  }

  private String url() {
    return "/api/v1/characters/" + character.getId() + "/voice-profiles";
  }

  private String body(long version, String description) {
    return """
        {"expectedRowVersion":%d,"language":"vi-VN","accent":"Northern",
         "voiceDescription":"%s","deliveryBaseline":"Calm"}
        """
        .formatted(version, description);
  }

  @Test
  void createsAndPinsVoiceAtomicallyAndPreservesTheOldLockedProfile() throws Exception {
    mvc.perform(get(url()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.profiles").isEmpty());
    mvc.perform(
            post(url()).contentType(MediaType.APPLICATION_JSON).content(body(0, "Warm low voice")))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.versionNumber").value(1));
    UUID firstId = characters.findById(character.getId()).orElseThrow().getPinnedVoiceProfileId();
    var first = profiles.findById(firstId).orElseThrow();
    first.lock();
    profiles.save(first);
    mvc.perform(
            post(url())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(1, "Clear bright voice")))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.versionNumber").value(2));
    var saved = characters.findById(character.getId()).orElseThrow();
    assertNotEquals(firstId, saved.getPinnedVoiceProfileId());
    assertEquals("Warm low voice", profiles.findById(firstId).orElseThrow().getVoiceDescription());
    assertNotNull(profiles.findById(firstId).orElseThrow().getLockedAt());
    mvc.perform(get(url()))
        .andExpect(jsonPath("$.data.profiles.length()").value(2))
        .andExpect(
            jsonPath("$.data.pinnedVoiceProfileId")
                .value(saved.getPinnedVoiceProfileId().toString()));
    UUID project = UuidV7.random(), participation = UuidV7.random();
    jdbc.update(
        "INSERT INTO projects (id,name,status,source_language,narration_language,image_aspect_ratio) VALUES (?,'Voice test','ACTIVE','vi-VN','vi-VN','16:9')",
        project);
    jdbc.update(
        "INSERT INTO project_characters (id,project_id,character_id,role,importance) VALUES (?,?,?,'SUPPORTING','SECONDARY')",
        participation,
        project,
        character.getId());
    var resolved = resolver.resolveSpeakerVoice(participation).orElseThrow();
    assertEquals(saved.getPinnedVoiceProfileId(), resolved.voiceProfileId());
    assertEquals("Clear bright voice", resolved.voiceDescription());
  }

  @Test
  void staleEditorCannotReplaceANewerVoiceOrLeaveAnExtraVersion() throws Exception {
    mvc.perform(post(url()).contentType(MediaType.APPLICATION_JSON).content(body(0, "First voice")))
        .andExpect(status().isCreated());
    UUID pinned = characters.findById(character.getId()).orElseThrow().getPinnedVoiceProfileId();
    mvc.perform(post(url()).contentType(MediaType.APPLICATION_JSON).content(body(0, "Stale draft")))
        .andExpect(status().isConflict());
    assertEquals(1, profiles.findByCharacterId(character.getId()).size());
    assertEquals(
        pinned, characters.findById(character.getId()).orElseThrow().getPinnedVoiceProfileId());
  }

  @Test
  void rejectsBlankOversizedAndUnversionedRequestsBeforeAnyWrite() throws Exception {
    for (String input :
        List.of(
            body(0, "  "),
            body(0, "x".repeat(2001)),
            body(0, "voice").replace("\"expectedRowVersion\":0,", ""))) {
      mvc.perform(post(url()).contentType(MediaType.APPLICATION_JSON).content(input))
          .andExpect(status().isBadRequest());
    }
    assertTrue(profiles.findByCharacterId(character.getId()).isEmpty());
    assertNull(characters.findById(character.getId()).orElseThrow().getPinnedVoiceProfileId());
  }

  @Test
  void missingAndArchivedCharactersCannotGetANewVoice() throws Exception {
    mvc.perform(
            post("/api/v1/characters/" + UuidV7.random() + "/voice-profiles")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(0, "voice")))
        .andExpect(status().isNotFound());
    character.archive();
    character = characters.save(character);
    mvc.perform(
            post(url())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(character.getRowVersion(), "voice")))
        .andExpect(status().isNotFound());
    assertTrue(profiles.findByCharacterId(character.getId()).isEmpty());
  }
}
