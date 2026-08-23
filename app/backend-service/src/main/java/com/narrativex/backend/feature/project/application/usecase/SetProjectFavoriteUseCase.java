package com.narrativex.backend.feature.project.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.project.application.port.out.ProjectFavoriteRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SetProjectFavoriteUseCase {
  private final ProjectFavoriteRepository favorites;
  private final CurrentUserId currentUserId;

  @Transactional
  public void add(UUID projectId) {
    favorites.add(currentUserId.get(), projectId);
  }

  @Transactional
  public void remove(UUID projectId) {
    favorites.remove(currentUserId.get(), projectId);
  }
}
