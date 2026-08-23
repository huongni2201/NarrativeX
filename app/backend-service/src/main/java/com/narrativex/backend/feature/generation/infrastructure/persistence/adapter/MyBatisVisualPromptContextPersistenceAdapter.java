package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.CharacterCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.LocationCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.VisualPromptContext;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.VisualPromptContextMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisVisualPromptContextPersistenceAdapter implements VisualPromptContextRepository {
  private final VisualPromptContextMapper mapper;

  @Override
  public VisualPromptContext findForScene(Long projectId, Long sceneId) {
    var locationRow = mapper.findLocation(projectId, sceneId);
    LocationCanon location =
        locationRow == null || locationRow.getLocationId() == null
            ? null
            : new LocationCanon(
                locationRow.getLocationId(),
                locationRow.getName(),
                locationRow.getDescription(),
                locationRow.getVisualPrompt());

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
                        row.getWardrobeContext()))
            .toList();

    return new VisualPromptContext(location, characters);
  }
}
