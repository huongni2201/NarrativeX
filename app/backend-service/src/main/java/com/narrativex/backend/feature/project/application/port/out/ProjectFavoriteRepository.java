package com.narrativex.backend.feature.project.application.port.out;

import java.util.UUID;

public interface ProjectFavoriteRepository {
  void add(UUID projectId);

  void remove(UUID projectId);
}
