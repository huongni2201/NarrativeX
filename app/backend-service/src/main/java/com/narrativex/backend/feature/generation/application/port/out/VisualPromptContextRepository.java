package com.narrativex.backend.feature.generation.application.port.out;

import java.util.List;
import java.util.UUID;

/** Read-only generation projection used to snapshot character and location continuity. */
public interface VisualPromptContextRepository {
  VisualPromptContext findForScene(UUID projectId, UUID sceneId);

  /**
   * Resolve only characters participating in one Visual Beat. Legacy/manual beats without explicit
   * beat-character rows may fall back to the parent scene cast in the persistence adapter.
   */
  VisualPromptContext findForBeat(UUID projectId, UUID visualBeatId);

  record VisualPromptContext(LocationCanon location, List<CharacterCanon> characters) {
    public VisualPromptContext {
      characters = characters == null ? List.of() : List.copyOf(characters);
    }

    public static VisualPromptContext empty() {
      return new VisualPromptContext(null, List.of());
    }
  }

  record LocationCanon(UUID locationId, String name, String description, String visualPrompt) {}

  record CharacterReference(
      UUID assetId,
      String role,
      int priority,
      String storageKey,
      String contentType,
      String sha256) {}

  record CharacterCanon(
      UUID assignmentId,
      UUID characterId,
      String canonicalName,
      Integer versionNumber,
      String visualPrompt,
      String appearancePrompt,
      String ageState,
      String hairstyle,
      String injury,
      String wardrobeContext,
      String beatRole,
      List<CharacterReference> references) {
    public CharacterCanon {
      references = references == null ? List.of() : List.copyOf(references);
    }
  }
}
