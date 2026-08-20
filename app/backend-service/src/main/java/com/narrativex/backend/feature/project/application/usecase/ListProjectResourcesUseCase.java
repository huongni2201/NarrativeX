package com.narrativex.backend.feature.project.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.project.application.port.out.ProjectResourceQueryRepository;
import com.narrativex.backend.feature.project.application.query.ProjectResourceView;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ListProjectResourcesUseCase {
  private final CurrentUserId currentUserId;
  private final ProjectAccess projectAccess;
  private final ProjectResourceQueryRepository repository;

  @Transactional(readOnly = true)
  public CursorPage<ProjectResourceView.Location> locations(Long projectId, String cursor, int limit) {
    validateLimit(limit);
    projectAccess.findOwnedProject(projectId, currentUserId.get());
    return repository.listLocations(projectId, cursor, limit);
  }

  @Transactional(readOnly = true)
  public CursorPage<ProjectResourceView.Asset> assets(Long projectId, String cursor, int limit) {
    validateLimit(limit);
    projectAccess.findOwnedProject(projectId, currentUserId.get());
    return repository.listAssets(projectId, cursor, limit);
  }

  private static void validateLimit(int limit) {
    if (limit < 1 || limit > 100) {
      throw new DomainValidationException("limit must be between 1 and 100");
    }
  }
}
