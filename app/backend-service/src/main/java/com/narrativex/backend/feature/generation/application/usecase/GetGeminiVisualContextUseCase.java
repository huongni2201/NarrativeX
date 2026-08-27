package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.CharacterCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.CharacterReference;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Read-only, ownership-scoped continuity context for Desktop Gemini Web generation. */
@Service
@RequiredArgsConstructor
public class GetGeminiVisualContextUseCase {
  private static final int MAX_REFERENCE_IMAGES = 3;

  private final CurrentUserId currentUserId;
  private final ProjectAccess projectAccess;
  private final VisualPromptContextRepository visualPromptContextRepository;

  @Transactional(readOnly = true)
  public GeminiVisualContext execute(UUID projectId, UUID sceneId) {
    projectAccess.findOwnedProject(projectId, currentUserId.get());
    var context = visualPromptContextRepository.findForScene(projectId, sceneId);
    var characters =
        context.characters().stream()
            .map(
                character ->
                    new GeminiCharacter(
                        character.assignmentId(),
                        character.characterId(),
                        character.canonicalName(),
                        character.versionNumber(),
                        character.visualPrompt(),
                        character.appearancePrompt(),
                        character.ageState(),
                        character.hairstyle(),
                        character.injury(),
                        character.wardrobeContext()))
            .toList();

    List<GeminiReference> references = new ArrayList<>();
    int index = 1;
    for (SelectedReference selected : selectReferences(context.characters())) {
      references.add(
          new GeminiReference(
              "REF_%02d".formatted(index++),
              selected.reference().assetId(),
              selected.character().assignmentId(),
              selected.character().characterId(),
              selected.character().canonicalName(),
              selected.reference().role(),
              selected.reference().priority()));
    }
    return new GeminiVisualContext(characters, List.copyOf(references));
  }

  private static List<SelectedReference> selectReferences(List<CharacterCanon> characters) {
    List<SelectedReference> selected = new ArrayList<>();
    Set<UUID> selectedAssetIds = new LinkedHashSet<>();
    if (characters == null || characters.isEmpty()) return selected;

    for (CharacterCanon character : characters) {
      sortedReferences(character).stream()
          .filter(reference -> selectedAssetIds.add(reference.assetId()))
          .findFirst()
          .ifPresent(reference -> selected.add(new SelectedReference(character, reference)));
      if (selected.size() == MAX_REFERENCE_IMAGES) return List.copyOf(selected);
    }

    for (CharacterCanon character : characters) {
      for (CharacterReference reference : sortedReferences(character)) {
        if (selectedAssetIds.add(reference.assetId())) {
          selected.add(new SelectedReference(character, reference));
        }
        if (selected.size() == MAX_REFERENCE_IMAGES) return List.copyOf(selected);
      }
    }
    return List.copyOf(selected);
  }

  private static List<CharacterReference> sortedReferences(CharacterCanon character) {
    return character.references().stream()
        .filter(reference -> reference != null && reference.assetId() != null)
        .sorted(
            Comparator.comparingInt(CharacterReference::priority)
                .thenComparing(CharacterReference::assetId))
        .toList();
  }

  private record SelectedReference(CharacterCanon character, CharacterReference reference) {}

  public record GeminiVisualContext(
      List<GeminiCharacter> characters, List<GeminiReference> references) {}

  public record GeminiCharacter(
      UUID assignmentId,
      UUID characterId,
      String canonicalName,
      Integer versionNumber,
      String visualPrompt,
      String appearancePrompt,
      String ageState,
      String hairstyle,
      String injury,
      String wardrobeContext) {}

  public record GeminiReference(
      String referenceKey,
      UUID assetId,
      UUID assignmentId,
      UUID characterId,
      String characterName,
      String role,
      int priority) {}
}
