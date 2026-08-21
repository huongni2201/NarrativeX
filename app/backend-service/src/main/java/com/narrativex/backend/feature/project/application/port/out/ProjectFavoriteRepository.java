package com.narrativex.backend.feature.project.application.port.out;

public interface ProjectFavoriteRepository {
  void add(String userId, Long projectId);

  void remove(String userId, Long projectId);
}
