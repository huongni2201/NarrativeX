package com.narrativex.backend.feature.project.application.port.out;

import java.util.UUID;

public interface ProjectFavoriteRepository {
  void add(String userId, UUID projectId);

  void remove(String userId, UUID projectId);
}
