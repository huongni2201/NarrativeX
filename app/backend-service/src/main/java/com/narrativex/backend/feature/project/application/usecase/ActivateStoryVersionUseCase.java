package com.narrativex.backend.feature.project.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.project.application.port.out.ProjectRepository;
import com.narrativex.backend.feature.project.application.port.out.StoryVersionRepository;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class ActivateStoryVersionUseCase {
  private final ProjectAccess projectAccess;
  private final ProjectRepository projectRepository;
  private final StoryVersionRepository storyVersionRepository;
  private final CurrentUserId currentUserId;

  @Transactional
  public StoryVersion execute(Long projectId, Long storyVersionId) {
    String ownerId = currentUserId.get();
    Project project = projectAccess.findOwnedProjectForUpdate(projectId, ownerId);
    StoryVersion nextVersion =
        storyVersionRepository
            .findByIdAndProjectId(storyVersionId, projectId)
            .orElseThrow(() -> new ResourceNotFoundException("Story version was not found"));
    Optional<StoryVersion> currentActive = storyVersionRepository.findActiveByProjectId(projectId);

    if (currentActive.map(StoryVersion::getId).filter(storyVersionId::equals).isPresent()) {
      project.reconcileActiveStoryVersion(nextVersion);
      projectRepository.save(project);
      log.debug("Story version id={} is already active for projectId={}", storyVersionId, projectId);
      return nextVersion;
    }

    project.activateStoryVersion(nextVersion, currentActive.orElse(null));

    // PostgreSQL's partial unique index is immediate. Flush the previous ACTIVE -> SUPERSEDED
    // update before persisting the next ACTIVE row so Hibernate cannot order an INSERT first.
    currentActive.ifPresent(storyVersionRepository::saveAndFlush);
    StoryVersion saved = storyVersionRepository.save(nextVersion);
    projectRepository.save(project);
    log.info(
        "Activated story version id={} (versionNumber={}) for projectId={}",
        saved.getId(),
        saved.getVersionNumber(),
        projectId);
    return saved;
  }
}
