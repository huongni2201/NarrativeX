package com.narrativex.backend.feature.character.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.character.application.port.out.CharacterRepository;
import com.narrativex.backend.feature.character.application.port.out.CharacterVoiceProfileRepository;
import com.narrativex.backend.feature.character.application.port.out.ProjectCharacterRepository;
import com.narrativex.backend.feature.character.domain.aggregate.Character;
import com.narrativex.backend.feature.character.domain.aggregate.ProjectCharacter;
import com.narrativex.backend.feature.character.domain.entity.CharacterVoiceProfile;
import com.narrativex.backend.feature.character.domain.enums.CharacterStatus;
import com.narrativex.backend.feature.character.domain.enums.CharacterVoiceProfileStatus;
import com.narrativex.backend.feature.character.domain.enums.ProjectCharacterStatus;
import com.narrativex.backend.feature.common.domain.enums.VoiceReferenceScope;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SpeakerVoiceResolverTest {
  private ProjectCharacterRepository projectCharacterRepository;
  private CharacterRepository characterRepository;
  private CharacterVoiceProfileRepository voiceProfileRepository;
  private SpeakerVoiceResolver resolver;

  @BeforeEach
  void setUp() {
    projectCharacterRepository = mock(ProjectCharacterRepository.class);
    characterRepository = mock(CharacterRepository.class);
    voiceProfileRepository = mock(CharacterVoiceProfileRepository.class);
    resolver =
        new SpeakerVoiceResolver(
            projectCharacterRepository, characterRepository, voiceProfileRepository);
  }

  @Test
  void resolvesSpeakerVoiceWhenPinnedVoiceProfileExists() {
    UUID speakerProjectCharId = UuidV7.random();
    UUID projectId = UuidV7.random();
    UUID characterId = UuidV7.random();
    UUID voiceProfileId = UuidV7.random();
    UUID referenceAssetId = UuidV7.random();

    ProjectCharacter projectCharacter =
        ProjectCharacter.rehydrate(
            speakerProjectCharId,
            0L,
            projectId,
            characterId,
            "PROTAGONIST",
            0,
            List.of(),
            null,
            List.of(),
            null,
            ProjectCharacterStatus.ACTIVE);

    Character character =
        Character.rehydrate(
            characterId, 0L, "Mina", List.of(), CharacterStatus.ACTIVE, voiceProfileId);

    CharacterVoiceProfile voiceProfile =
        CharacterVoiceProfile.rehydrate(
            voiceProfileId,
            0L,
            characterId,
            1,
            referenceAssetId,
            VoiceReferenceScope.GLOBAL_LOCAL,
            "vi-VN",
            "Northern",
            "Confident young female voice",
            "Energetic pacing",
            CharacterVoiceProfileStatus.ACTIVE,
            null);

    when(projectCharacterRepository.findById(speakerProjectCharId))
        .thenReturn(Optional.of(projectCharacter));
    when(characterRepository.findById(characterId)).thenReturn(Optional.of(character));
    when(voiceProfileRepository.findById(voiceProfileId)).thenReturn(Optional.of(voiceProfile));

    Optional<SpeakerVoiceResolver.ResolvedSpeakerVoice> resolved =
        resolver.resolveSpeakerVoice(speakerProjectCharId);

    assertTrue(resolved.isPresent());
    assertEquals(characterId, resolved.get().characterId());
    assertEquals("Mina", resolved.get().characterName());
    assertEquals(voiceProfileId, resolved.get().voiceProfileId());
    assertEquals(referenceAssetId, resolved.get().referenceAssetId());
    assertEquals(VoiceReferenceScope.GLOBAL_LOCAL, resolved.get().referenceScope());
    assertEquals("vi-VN", resolved.get().language());
    assertEquals("Northern", resolved.get().accent());
    assertEquals("Confident young female voice", resolved.get().voiceDescription());
  }

  @Test
  void returnsEmptyWhenSpeakerProjectCharacterIdIsNull() {
    Optional<SpeakerVoiceResolver.ResolvedSpeakerVoice> resolved =
        resolver.resolveSpeakerVoice(null);
    assertTrue(resolved.isEmpty());
  }

  @Test
  void returnsEmptyWhenCharacterHasNoVoiceProfiles() {
    UUID speakerProjectCharId = UuidV7.random();
    UUID projectId = UuidV7.random();
    UUID characterId = UuidV7.random();

    ProjectCharacter projectCharacter =
        ProjectCharacter.rehydrate(
            speakerProjectCharId,
            0L,
            projectId,
            characterId,
            "NARRATOR",
            1,
            List.of(),
            null,
            List.of(),
            null,
            ProjectCharacterStatus.ACTIVE);

    Character character =
        Character.rehydrate(characterId, 0L, "Narrator", List.of(), CharacterStatus.ACTIVE, null);

    when(projectCharacterRepository.findById(speakerProjectCharId))
        .thenReturn(Optional.of(projectCharacter));
    when(characterRepository.findById(characterId)).thenReturn(Optional.of(character));
    when(voiceProfileRepository.findPinnedByCharacterId(characterId)).thenReturn(Optional.empty());
    when(voiceProfileRepository.findByCharacterId(characterId)).thenReturn(List.of());

    Optional<SpeakerVoiceResolver.ResolvedSpeakerVoice> resolved =
        resolver.resolveSpeakerVoice(speakerProjectCharId);

    assertTrue(resolved.isEmpty());
  }
}
