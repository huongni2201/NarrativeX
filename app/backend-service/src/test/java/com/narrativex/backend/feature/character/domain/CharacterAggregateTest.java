package com.narrativex.backend.feature.character.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.narrativex.backend.feature.character.domain.aggregate.Character;
import com.narrativex.backend.feature.character.domain.aggregate.CharacterAppearance;
import com.narrativex.backend.feature.character.domain.aggregate.CharacterVersion;
import com.narrativex.backend.feature.character.domain.aggregate.enums.CharacterStatus;
import com.narrativex.backend.feature.character.domain.aggregate.enums.CharacterVersionStatus;
import com.narrativex.backend.feature.character.domain.aggregate.OutfitVersion;
import com.narrativex.backend.feature.character.domain.aggregate.enums.OutfitVersionStatus;
import com.narrativex.backend.feature.character.domain.aggregate.ProjectCharacter;
import org.junit.jupiter.api.Test;

class CharacterAggregateTest {

    @Test
    void oneCharacterIdentityCanBeAssignedToMultipleProjects() {
        Character character = Character.rehydrate(10L, 0L, "owner", null, "Mina", java.util.List.of("M"),
            CharacterStatus.ACTIVE);

        ProjectCharacter first = ProjectCharacter.assign(100L, character.getId(), "PROTAGONIST", 1,
            java.util.List.of(), null, java.util.List.of("main"), null);
        ProjectCharacter second = ProjectCharacter.assign(200L, character.getId(), "SUPPORTING", 2,
            java.util.List.of("Mina"), null, java.util.List.of("flashback"), null);

        assertEquals(first.getCharacterId(), second.getCharacterId());
        assertEquals(100L, first.getProjectId());
        assertEquals(200L, second.getProjectId());
    }

    @Test
    void appearanceIsStoryStateAndDoesNotCreateAnotherIdentity() {
        CharacterAppearance appearance = CharacterAppearance.create(10L, 100L, "chapter-1",
            "young", "short hair", null, "school uniform", "young character", null);

        assertEquals(10L, appearance.getCharacterId());
        assertEquals(100L, appearance.getProjectId());
    }

    @Test
    void appearanceRejectsAnOutfitVersionFromAnotherCharacter() {
        OutfitVersion outfit = OutfitVersion.rehydrate(11L, 0L, 20L, 1, "Mina travel", null, "prompt",
            OutfitVersionStatus.DRAFT);

        assertThrows(IllegalArgumentException.class, () -> CharacterAppearance.create(10L, 100L, "chapter-1",
            "young", "short hair", null, "school uniform", "young character", outfit));
    }

    @Test
    void characterVersionMustBeReviewedBeforeItCanBeLockedAndPinned() {
        CharacterVersion version = CharacterVersion.rehydrate(11L, 0L, 10L, 1, "bible", "prompt", null,
            java.util.List.of(), CharacterVersionStatus.DRAFT, null, null);
        ProjectCharacter assignment = ProjectCharacter.assign(100L, 10L, "PROTAGONIST", 1,
            java.util.List.of(), null, java.util.List.of(), null);

        assertThrows(IllegalStateException.class, () -> assignment.pinVersion(version));
        version.submitForReview();
        version.lock("owner");
        assignment.pinVersion(version);

        assertEquals(11L, assignment.getPinnedCharacterVersionId());
    }
}
