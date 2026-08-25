package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.CharacterCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.CharacterReference;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.LocationCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.VisualPromptContext;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.VisualPromptContextMapper;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisVisualPromptContextPersistenceAdapter implements VisualPromptContextRepository {
  private final VisualPromptContextMapper mapper;

  @Override
  public VisualPromptContext findForScene(UUID projectId, UUID sceneId) {
    var locationRow = mapper.findLocation(projectId, sceneId);
    LocationCanon location =
        locationRow == null || locationRow.getLocationId() == null
            ? null
            : new LocationCanon(
                locationRow.getLocationId(),
                locationRow.getName(),
                locationRow.getDescription(),
                locationRow.getVisualPrompt());

    Map<UUID, java.util.List<CharacterReference>> referencesByAssignment =
        mapper.findCharacterReferences(projectId, sceneId).stream()
            .collect(
                Collectors.groupingBy(
                    row -> row.getAssignmentId(),
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
        mapper.findCharacters(projectId, sceneId).stream()
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
                        referencesByAssignment.getOrDefault(
                            row.getAssignmentId(), java.util.List.of())))
            .toList();

    return new VisualPromptContext(location, characters);
  }
}
