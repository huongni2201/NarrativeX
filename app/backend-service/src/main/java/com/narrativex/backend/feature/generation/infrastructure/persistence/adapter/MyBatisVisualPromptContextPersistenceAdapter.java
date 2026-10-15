package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.CharacterCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.CharacterReference;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.LocationCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.VisualPromptContext;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.VisualPromptCharacterRow;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.VisualPromptContextMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.VisualPromptLocationRow;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.VisualPromptReferenceRow;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisVisualPromptContextPersistenceAdapter implements VisualPromptContextRepository {
  private final VisualPromptContextMapper mapper;

  @Override
  public VisualPromptContext findForScene(UUID projectId, UUID sceneId) {
    return toContext(
        mapper.findLocation(projectId, sceneId),
        mapper.findCharacters(projectId, sceneId),
        mapper.findCharacterReferences(projectId, sceneId));
  }

  @Override
  public VisualPromptContext findForBeat(UUID projectId, UUID visualBeatId) {
    return toContext(
        mapper.findLocationForBeat(projectId, visualBeatId),
        mapper.findCharactersForBeat(projectId, visualBeatId),
        mapper.findCharacterReferencesForBeat(projectId, visualBeatId));
  }

  @Override
  public Map<UUID, VisualPromptContext> findForBeats(UUID projectId, List<UUID> visualBeatIds) {
    if (visualBeatIds.isEmpty()) {
      return Map.of();
    }

    Map<UUID, VisualPromptLocationRow> locationsByBeat =
        mapper.findLocationsForBeats(projectId, visualBeatIds).stream()
            .collect(
                Collectors.toMap(
                    VisualPromptLocationRow::getVisualBeatId,
                    Function.identity(),
                    (left, right) -> left));
    Map<UUID, List<VisualPromptCharacterRow>> charactersByBeat =
        mapper.findCharactersForBeats(projectId, visualBeatIds).stream()
            .collect(Collectors.groupingBy(VisualPromptCharacterRow::getVisualBeatId));
    Map<UUID, List<VisualPromptReferenceRow>> referencesByBeat =
        mapper.findCharacterReferencesForBeats(projectId, visualBeatIds).stream()
            .collect(Collectors.groupingBy(VisualPromptReferenceRow::getVisualBeatId));
    Map<UUID, VisualPromptContext> contexts = new LinkedHashMap<>();
    for (UUID visualBeatId : visualBeatIds) {
      contexts.put(
          visualBeatId,
          toContext(
              locationsByBeat.get(visualBeatId),
              charactersByBeat.getOrDefault(visualBeatId, List.of()),
              referencesByBeat.getOrDefault(visualBeatId, List.of())));
    }
    return Collections.unmodifiableMap(contexts);
  }

  private static VisualPromptContext toContext(
      VisualPromptLocationRow locationRow,
      List<VisualPromptCharacterRow> characterRows,
      List<VisualPromptReferenceRow> referenceRows) {
    LocationCanon location =
        locationRow == null || locationRow.getLocationId() == null
            ? null
            : new LocationCanon(
                locationRow.getLocationId(),
                locationRow.getName(),
                locationRow.getDescription(),
                locationRow.getVisualPrompt());

    Map<UUID, List<CharacterReference>> referencesByAssignment =
        referenceRows.stream()
            .collect(
                Collectors.groupingBy(
                    VisualPromptReferenceRow::getAssignmentId,
                    Collectors.mapping(
                        row ->
                            new CharacterReference(
                                row.getAssetId(),
                                row.getRole(),
                                row.getPriority(),
                                row.getStorageKey(),
                                row.getContentType(),
                                row.getSha256()),
                        Collectors.toList())));

    var characters =
        characterRows.stream()
            .map(
                row ->
                    new CharacterCanon(
                        row.getAssignmentId(),
                        row.getCharacterId(),
                        row.getCanonicalName(),
                        row.getVersionNumber(),
                        row.getVisualPrompt(),
                        row.getAppearancePrompt(),
                        row.getAgeState(),
                        row.getHairstyle(),
                        row.getInjury(),
                        row.getWardrobeContext(),
                        row.getBeatRole(),
                        referencesByAssignment.getOrDefault(row.getAssignmentId(), List.of())))
            .toList();

    return new VisualPromptContext(location, characters);
  }
}
