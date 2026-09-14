package com.narrativex.backend.feature.project.application.usecase;

import com.narrativex.backend.feature.project.application.port.out.ProjectFavoriteRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SetProjectFavoriteUseCase {
  private final ProjectFavoriteRepository favorites;

  @Transactional
  public void add(UUID projectId) {
    favorites.add(projectId);
  }

  @Transactional
  public void remove(UUID projectId) {
    favorites.remove(projectId);
  }
}
