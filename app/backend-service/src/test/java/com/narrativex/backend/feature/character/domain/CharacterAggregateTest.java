package com.narrativex.backend.feature.character.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.narrativex.backend.feature.character.domain.aggregate.Character;
import com.narrativex.backend.feature.character.domain.aggregate.ProjectCharacter;
import com.narrativex.backend.feature.character.domain.entity.CharacterAppearance;
import com.narrativex.backend.feature.character.domain.entity.CharacterVersion;
import com.narrativex.backend.feature.character.domain.entity.OutfitVersion;
import com.narrativex.backend.feature.character.domain.enums.CharacterStatus;
import com.narrativex.backend.feature.character.domain.enums.CharacterVersionStatus;
import com.narrativex.backend.feature.character.domain.enums.OutfitVersionStatus;
import com.narrativex.backend.feature.character.domain.exception.InvalidProjectCharacterTransitionException;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CharacterAggregateTest {

  @Test
  void oneCharacterIdentityCanBeAssignedToMultipleProjects() {
    UUID characterId = UuidV7.random();
    UUID project1Id = UuidV7.random();
    UUID project2Id = UuidV7.random();
    Character character =
        Character.rehydrate(
            characterId, 0L, "owner", null, "Mina", java.util.List.of("M"), CharacterStatus.ACTIVE);

    ProjectCharacter first =
        ProjectCharacter.assign(
            project1Id,
            character.getId(),
            "PROTAGONIST",
            1,
            java.util.List.of(),
            null,
            java.util.List.of("main"),
            null);
    ProjectCharacter second =
        ProjectCharacter.assign(
            project2Id,
            character.getId(),
            "SUPPORTING",
            2,
            java.util.List.of("Mina"),
            null,
            java.util.List.of("flashback"),
            null);

    assertEquals(first.getCharacterId(), second.getCharacterId());
    assertEquals(project1Id, first.getProjectId());
    assertEquals(project2Id, second.getProjectId());
  }

  @Test
  void appearanceIsStoryStateAndDoesNotCreateAnotherIdentity() {
    UUID characterId = UuidV7.random();
    UUID projectId = UuidV7.random();
    CharacterAppearance appearance =
        CharacterAppearance.create(
            characterId,
            projectId,
            "chapter-1",
            "young",
            "short hair",
            null,
            "school uniform",
            "young character",
            null);

    assertEquals(characterId, appearance.getCharacterId());
    assertEquals(projectId, appearance.getProjectId());
  }

  @Test
  void appearanceRejectsAnOutfitVersionFromAnotherCharacter() {
    UUID characterId = UuidV7.random();
    UUID otherCharacterId = UuidV7.random();
    UUID projectId = UuidV7.random();
    UUID outfitId = UuidV7.random();
    OutfitVersion outfit =
        OutfitVersion.rehydrate(
            outfitId,
            0L,
            otherCharacterId,
            1,
            "Mina travel",
            null,
            "prompt",
            OutfitVersionStatus.DRAFT);

    assertThrows(
        IllegalArgumentException.class,
        () ->
            CharacterAppearance.create(
                characterId,
                projectId,
                "chapter-1",
                "young",
                "short hair",
                null,
                "school uniform",
                "young character",
                outfit));
  }

  @Test
  void characterVersionMustBeReviewedBeforeItCanBeLockedAndPinned() {
    UUID characterId = UuidV7.random();
    UUID versionId = UuidV7.random();
    UUID projectId = UuidV7.random();
    CharacterVersion version =
        CharacterVersion.rehydrate(
            versionId,
            0L,
            characterId,
            1,
            "bible",
            "prompt",
            CharacterVersionStatus.DRAFT,
            null,
            null);
    ProjectCharacter assignment =
        ProjectCharacter.assign(
            projectId,
            characterId,
            "PROTAGONIST",
            1,
            java.util.List.of(),
            null,
            java.util.List.of(),
            null);

    assertThrows(
        InvalidProjectCharacterTransitionException.class, () -> assignment.pinVersion(version));
    version.submitForReview();
    version.lock("owner");
    assignment.pinVersion(version);

    assertEquals(versionId, assignment.getPinnedCharacterVersionId());
  }
}
