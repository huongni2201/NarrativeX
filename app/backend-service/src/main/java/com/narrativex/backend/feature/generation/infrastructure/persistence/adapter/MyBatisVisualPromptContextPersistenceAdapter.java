package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.BeatContinuity;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.CharacterCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.CharacterReference;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.LocationCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.VisualPromptContext;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.VisualPromptCharacterRow;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.VisualPromptContinuityMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.VisualPromptContinuityRow;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.VisualPromptContextMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.VisualPromptLocationRow;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.VisualPromptReferenceRow;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisVisualPromptContextPersistenceAdapter implements VisualPromptContextRepository {
  private final VisualPromptContextMapper mapper;
  private final VisualPromptContinuityMapper continuityMapper;

  @Override
  public VisualPromptContext findForScene(UUID projectId, UUID sceneId) {
    return toContext(
        mapper.findLocation(projectId, sceneId),
        mapper.findCharacters(projectId, sceneId),
        mapper.findCharacterReferences(projectId, sceneId),
        null);
  }

  @Override
  public VisualPromptContext findForBeat(UUID projectId, UUID visualBeatId) {
    return toContext(
        mapper.findLocationForBeat(projectId, visualBeatId),
        mapper.findCharactersForBeat(projectId, visualBeatId),
        mapper.findCharacterReferencesForBeat(projectId, visualBeatId),
        continuityMapper.findForBeat(projectId, visualBeatId));
  }

  private static VisualPromptContext toContext(
      VisualPromptLocationRow locationRow,
      List<VisualPromptCharacterRow> characterRows,
      List<VisualPromptReferenceRow> referenceRows,
      VisualPromptContinuityRow continuityRow) {
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
                        referencesByAssignment.getOrDefault(
                            row.getAssignmentId(), java.util.List.of())))
            .toList();

    BeatContinuity continuity =
        continuityRow == null || continuityRow.getPlanId() == null
            ? null
            : new BeatContinuity(
                continuityRow.getPlanId(),
                continuityRow.getTimelineKey(),
                continuityRow.getEntryFactsJson(),
                continuityRow.getVisibleFactsJson(),
                continuityRow.getExitFactsJson(),
                continuityRow.getEventKeysJson(),
                continuityRow.getSemanticHash());
    return new VisualPromptContext(location, characters, continuity);
  }
}
