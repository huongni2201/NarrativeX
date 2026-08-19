package com.narrativex.backend.feature.project.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.project.application.port.out.ProjectResourceQueryRepository;
import com.narrativex.backend.feature.project.application.query.ProjectResourceView;
import java.util.List;
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
  public List<ProjectResourceView.Location> locations(Long projectId) {
    projectAccess.findOwnedProject(projectId, currentUserId.get());
    return repository.listLocations(projectId);
  }

  @Transactional(readOnly = true)
  public List<ProjectResourceView.Asset> assets(Long projectId) {
    projectAccess.findOwnedProject(projectId, currentUserId.get());
    return repository.listAssets(projectId);
  }
}
