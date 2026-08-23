package com.narrativex.backend.feature.generation.application.port.out;

import java.util.List;
import java.util.UUID;

/** Read-only generation projection used to snapshot character and location continuity. */
public interface VisualPromptContextRepository {
  VisualPromptContext findForScene(Long projectId, Long sceneId);

  record VisualPromptContext(LocationCanon location, List<CharacterCanon> characters) {
    public VisualPromptContext {
      characters = characters == null ? List.of() : List.copyOf(characters);
    }

    public static VisualPromptContext empty() {
      return new VisualPromptContext(null, List.of());
    }
  }

  record LocationCanon(Long locationId, String name, String description, String visualPrompt) {}

  record CharacterReference(
      UUID assetId,
      String role,
      int priority,
      String storageKey,
      String contentType,
      String sha256) {}

  record CharacterCanon(
      Long assignmentId,
      Long characterId,
      String canonicalName,
      Integer versionNumber,
      String visualPrompt,
      String appearancePrompt,
      String ageState,
      String hairstyle,
      String injury,
      String wardrobeContext,
      List<CharacterReference> references) {
    public CharacterCanon {
      references = references == null ? List.of() : List.copyOf(references);
    }
  }
}
