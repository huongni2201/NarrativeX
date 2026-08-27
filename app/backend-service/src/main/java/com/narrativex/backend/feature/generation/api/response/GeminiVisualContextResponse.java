package com.narrativex.backend.feature.generation.api.response;

import com.narrativex.backend.feature.generation.application.usecase.GetGeminiVisualContextUseCase.GeminiCharacter;
import com.narrativex.backend.feature.generation.application.usecase.GetGeminiVisualContextUseCase.GeminiReference;
import com.narrativex.backend.feature.generation.application.usecase.GetGeminiVisualContextUseCase.GeminiVisualContext;
import java.util.List;
import java.util.UUID;

public record GeminiVisualContextResponse(
    List<CharacterResponse> characters, List<ReferenceResponse> references) {

  public static GeminiVisualContextResponse from(GeminiVisualContext context) {
    return new GeminiVisualContextResponse(
        context.characters().stream().map(CharacterResponse::from).toList(),
        context.references().stream().map(ReferenceResponse::from).toList());
  }

  public record CharacterResponse(
      UUID assignmentId,
      UUID characterId,
      String canonicalName,
      Integer versionNumber,
      String visualPrompt,
      String appearancePrompt,
      String ageState,
      String hairstyle,
      String injury,
      String wardrobeContext) {
    static CharacterResponse from(GeminiCharacter character) {
      return new CharacterResponse(
          character.assignmentId(),
          character.characterId(),
          character.canonicalName(),
          character.versionNumber(),
          character.visualPrompt(),
          character.appearancePrompt(),
          character.ageState(),
          character.hairstyle(),
          character.injury(),
          character.wardrobeContext());
    }
  }

  public record ReferenceResponse(
      String referenceKey,
      UUID assetId,
      UUID assignmentId,
      UUID characterId,
      String characterName,
      String role,
      int priority) {
    static ReferenceResponse from(GeminiReference reference) {
      return new ReferenceResponse(
          reference.referenceKey(),
          reference.assetId(),
          reference.assignmentId(),
          reference.characterId(),
          reference.characterName(),
          reference.role(),
          reference.priority());
    }
  }
}
