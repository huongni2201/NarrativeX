package com.narrativex.backend.feature.project.application.usecase;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.project.application.port.out.ProjectRepository;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Soft-deletes a project by moving it to the durable archived lifecycle state. */
@Slf4j
@Service
@RequiredArgsConstructor
public class DeleteProjectUseCase {
  private final ProjectRepository projectRepository;

  @Transactional
  public void execute(UUID projectId) {
    Project project =
        projectRepository
            .findByIdForUpdate(projectId)
            .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

    project.archive();
    projectRepository.save(project);
    log.info("Archived project id={}", projectId);
  }
}
