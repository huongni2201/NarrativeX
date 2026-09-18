package com.narrativex.backend.feature.storyboard.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.CharacterRow;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.CharacterVersionRow;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.ProjectCharacterRow;
import com.narrativex.backend.feature.generation.application.model.analysis.AnalyzedCharacter;
import com.narrativex.backend.feature.generation.application.model.analysis.AnalyzedLocation;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterCanon;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter.ChapterCanonReconciliationService;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterCanonMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ProjectCharacterBindingRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ProjectLocationBindingRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ProjectLocationRow;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class ChapterCanonReconciliationServiceTest {

  private ChapterCanonMapper canonMapper;
  private ChapterCanonReconciliationService service;
  private UUID projectId;

  @BeforeEach
  void setUp() {
    canonMapper = mock(ChapterCanonMapper.class);
    service = new ChapterCanonReconciliationService(canonMapper);
    projectId = UUID.randomUUID();
  }

  @Test
  void reconcileNewCharactersAndLocationsCreatesEntitiesAndIndexLookups() {
    when(canonMapper.findProjectCharacterBindings(projectId)).thenReturn(new ArrayList<>());
    when(canonMapper.findProjectLocationBindings(projectId)).thenReturn(new ArrayList<>());

    UUID charId = UUID.randomUUID();
    UUID versionId = UUID.randomUUID();
    UUID projectCharId = UUID.randomUUID();
    UUID locId = UUID.randomUUID();

    when(canonMapper.insertCharacter(any(CharacterRow.class))).thenReturn(charId);
    when(canonMapper.insertCharacterVersion(any(CharacterVersionRow.class))).thenReturn(versionId);
    when(canonMapper.insertProjectCharacter(any(ProjectCharacterRow.class))).thenReturn(projectCharId);
    when(canonMapper.insertProjectLocation(any(ProjectLocationRow.class))).thenReturn(locId);

    AnalyzedCharacter character =
        new AnalyzedCharacter(
            "char_1",
            "Elena Vance",
            List.of("Elena", "Agent Vance"),
            "PROTAGONIST",
            "PRIMARY",
            "Protagonist engineer",
            "30yo woman with glasses and leather jacket");

    AnalyzedLocation location =
        new AnalyzedLocation(
            "loc_1",
            "The Workshop",
            List.of("Workshop", "Lab"),
            "Secret basement garage",
            "Underground garage with tools and monitors");

    ChapterCanon canon = new ChapterCanon(List.of(character), List.of(location));
    var result = service.reconcileAndPersist(projectId, canon);

    assertNotNull(result);
    assertEquals(projectCharId, result.findCharacterId("char_1"));
    assertEquals(projectCharId, result.findCharacterId("Elena Vance"));
    assertEquals(projectCharId, result.findCharacterId("Elena"));
    assertEquals(projectCharId, result.findCharacterId("Agent Vance"));
    assertEquals(projectCharId, result.findCharacterId("ELENA VANCE")); // case-insensitive

    assertEquals(locId, result.findLocationId("loc_1"));
    assertEquals(locId, result.findLocationId("The Workshop"));
    assertEquals(locId, result.findLocationId("Workshop"));
    assertEquals(locId, result.findLocationId("Lab"));
    assertEquals(locId, result.findLocationId("the workshop")); // case-insensitive

    verify(canonMapper).insertCharacter(any(CharacterRow.class));
    verify(canonMapper).insertCharacterVersion(any(CharacterVersionRow.class));
    verify(canonMapper).insertProjectCharacter(any(ProjectCharacterRow.class));
    verify(canonMapper).insertProjectLocation(any(ProjectLocationRow.class));
  }

  @Test
  void reconcileExistingCharacterReusesBindingWithoutDuplicates() {
    UUID existingCharId = UUID.randomUUID();
    UUID existingProjectCharId = UUID.randomUUID();

    ProjectCharacterBindingRow existingRow = new ProjectCharacterBindingRow();
    existingRow.setProjectId(projectId);
    existingRow.setCharacterId(existingCharId);
    existingRow.setProjectCharacterId(existingProjectCharId);
    existingRow.setCanonicalName("Elena Vance");
    existingRow.setAiName("char_legacy");
    existingRow.setCharacterAliasesJson("[\"Elena\"]");

    when(canonMapper.findProjectCharacterBindings(projectId))
        .thenReturn(new ArrayList<>(List.of(existingRow)));

    AnalyzedCharacter character =
        new AnalyzedCharacter(
            "char_new",
            "Elena Vance",
            List.of("Elena"),
            "PROTAGONIST",
            "PRIMARY",
            "Engineer",
            "Visual prompt");

    ChapterCanon canon = new ChapterCanon(List.of(character), List.of());
    var result = service.reconcileAndPersist(projectId, canon);

    assertEquals(existingProjectCharId, result.findCharacterId("char_new"));
    assertEquals(existingProjectCharId, result.findCharacterId("Elena Vance"));

    // No new character or project character row should be created
    verify(canonMapper, never()).insertCharacter(any());
    verify(canonMapper, never()).insertProjectCharacter(any());
    // AI identity binding should be upserted for the project character
    verify(canonMapper).upsertProjectCharacterAiIdentity(eq(projectId), eq(existingProjectCharId), eq("char_new"), any());
  }

  @Test
  void lockedCharacterVersionPreservedWithNewVersionOnVisualPromptChange() {
    UUID existingCharId = UUID.randomUUID();
    UUID existingProjectCharId = UUID.randomUUID();

    ProjectCharacterBindingRow existingRow = new ProjectCharacterBindingRow();
    existingRow.setProjectId(projectId);
    existingRow.setCharacterId(existingCharId);
    existingRow.setProjectCharacterId(existingProjectCharId);
    existingRow.setCanonicalName("Marcus");
    existingRow.setAiName("char_marcus");
    existingRow.setVersionLockedAt(Instant.now());
    existingRow.setVersionStatus("LOCKED");
    existingRow.setVisualPrompt("Initial costume: standard suit");

    when(canonMapper.findProjectCharacterBindings(projectId))
        .thenReturn(new ArrayList<>(List.of(existingRow)));
    when(canonMapper.maxCharacterVersion(existingCharId)).thenReturn(1);

    AnalyzedCharacter character =
        new AnalyzedCharacter(
            "char_marcus",
            "Marcus",
            List.of(),
            "SUPPORTING",
            "SECONDARY",
            "Marcus in battle armor",
            "Updated costume: heavy combat armor");

    ChapterCanon canon = new ChapterCanon(List.of(character), List.of());
    service.reconcileAndPersist(projectId, canon);

    ArgumentCaptor<CharacterVersionRow> versionCaptor = ArgumentCaptor.forClass(CharacterVersionRow.class);
    verify(canonMapper).insertCharacterVersion(versionCaptor.capture());

    CharacterVersionRow createdVersion = versionCaptor.getValue();
    assertEquals(existingCharId, createdVersion.getCharacterId());
    assertEquals(2, createdVersion.getVersionNumber());
    assertEquals("DRAFT", createdVersion.getStatus());
    assertEquals("Updated costume: heavy combat armor", createdVersion.getVisualPrompt());
  }

  @Test
  void lockedCharacterVersionUntouchedWhenVisualPromptUnchanged() {
    UUID existingCharId = UUID.randomUUID();
    UUID existingProjectCharId = UUID.randomUUID();

    ProjectCharacterBindingRow existingRow = new ProjectCharacterBindingRow();
    existingRow.setProjectId(projectId);
    existingRow.setCharacterId(existingCharId);
    existingRow.setProjectCharacterId(existingProjectCharId);
    existingRow.setCanonicalName("Marcus");
    existingRow.setAiName("char_marcus");
    existingRow.setVersionLockedAt(Instant.now());
    existingRow.setVersionStatus("LOCKED");
    existingRow.setVisualPrompt("Same costume");

    when(canonMapper.findProjectCharacterBindings(projectId))
        .thenReturn(new ArrayList<>(List.of(existingRow)));

    AnalyzedCharacter character =
        new AnalyzedCharacter(
            "char_marcus",
            "Marcus",
            List.of(),
            "SUPPORTING",
            "SECONDARY",
            "Description",
            "Same costume");

    ChapterCanon canon = new ChapterCanon(List.of(character), List.of());
    service.reconcileAndPersist(projectId, canon);

    // No new character version should be created
    verify(canonMapper, never()).insertCharacterVersion(any());
  }

  @Test
  void nullOrEmptyCanonReturnsEmptyMapsGracefully() {
    var resultNull = service.reconcileAndPersist(projectId, null);
    assertNotNull(resultNull);
    assertNull(resultNull.findCharacterId("any"));
    assertNull(resultNull.findLocationId("any"));

    var resultEmpty = service.reconcileAndPersist(projectId, new ChapterCanon(List.of(), List.of()));
    assertNotNull(resultEmpty);
    assertTrue(resultEmpty.characterMap().isEmpty());
    assertTrue(resultEmpty.locationMap().isEmpty());
  }
}
