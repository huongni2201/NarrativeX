package com.narrativex.backend.feature.generation.application.port.out;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Read-only generation projection used to snapshot character, location and beat continuity. */
public interface VisualPromptContextRepository {
  VisualPromptContext findForScene(UUID projectId, UUID sceneId);

  /**
   * Resolve only characters participating in one Visual Beat. Legacy/manual beats without explicit
   * beat-character rows may fall back to the parent scene cast in the persistence adapter.
   */
  VisualPromptContext findForBeat(UUID projectId, UUID visualBeatId);

  /**
   * Resolve contexts for a storyboard scope in bounded batch queries. Implementations should
   * override this method; the default preserves compatibility for test doubles and non-MyBatis
   * adapters.
   */
  default Map<UUID, VisualPromptContext> findForBeats(UUID projectId, List<UUID> visualBeatIds) {
    Map<UUID, VisualPromptContext> contexts = new LinkedHashMap<>();
    for (UUID visualBeatId : visualBeatIds) {
      contexts.put(visualBeatId, findForBeat(projectId, visualBeatId));
    }
    return Map.copyOf(contexts);
  }

  record VisualPromptContext(
      LocationCanon location, List<CharacterCanon> characters, BeatContinuity continuity) {
    public VisualPromptContext {
      characters = characters == null ? List.of() : List.copyOf(characters);
    }

    public VisualPromptContext(LocationCanon location, List<CharacterCanon> characters) {
      this(location, characters, null);
    }

    public static VisualPromptContext empty() {
      return new VisualPromptContext(null, List.of(), null);
    }
  }

  record BeatContinuity(
      UUID planId,
      String timelineKey,
      String entryFactsJson,
      String visibleFactsJson,
      String exitFactsJson,
      String eventKeysJson,
      String semanticHash) {}

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
