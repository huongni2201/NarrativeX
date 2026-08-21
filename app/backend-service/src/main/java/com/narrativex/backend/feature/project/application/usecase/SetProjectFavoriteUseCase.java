package com.narrativex.backend.feature.project.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.project.infrastructure.persistence.mybatis.ProjectDashboardMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SetProjectFavoriteUseCase {
  private final ProjectDashboardMapper mapper;
  private final CurrentUserId currentUserId;

  @Transactional
  public void add(Long projectId) {
    mapper.addFavorite(currentUserId.get(), projectId);
  }

  @Transactional
  public void remove(Long projectId) {
    mapper.removeFavorite(currentUserId.get(), projectId);
  }
}
