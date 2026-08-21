package com.narrativex.backend.feature.project.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.project.application.port.out.ProjectFavoriteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SetProjectFavoriteUseCase {
  private final ProjectFavoriteRepository favorites;
  private final CurrentUserId currentUserId;

  @Transactional
  public void add(Long projectId) {
    favorites.add(currentUserId.get(), projectId);
  }

  @Transactional
  public void remove(Long projectId) {
    favorites.remove(currentUserId.get(), projectId);
  }
}
