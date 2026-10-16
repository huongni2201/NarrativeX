package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.ShotLocationContextRepository;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.LocationCanon;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ShotLocationContextMapper;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisShotLocationContextPersistenceAdapter implements ShotLocationContextRepository {
  private final ShotLocationContextMapper mapper;

  @Override
  public Map<UUID, ShotLocationContext> findForShots(UUID projectId, List<UUID> shotIds) {
    if (shotIds.isEmpty()) {
      return Map.of();
    }
    Map<UUID, ShotLocationContext> contexts = new LinkedHashMap<>();
    for (var row : mapper.findForShots(projectId, List.copyOf(shotIds))) {
      LocationCanon location =
          row.getLocationId() == null
              ? null
              : new LocationCanon(
                  row.getLocationId(), row.getName(), row.getDescription(), row.getVisualPrompt());
      contexts.put(
          row.getShotId(),
          new ShotLocationContext(
              location, row.getPreviousShotId(), row.getPreviousEndStateJson()));
    }
    return Collections.unmodifiableMap(contexts);
  }
}
