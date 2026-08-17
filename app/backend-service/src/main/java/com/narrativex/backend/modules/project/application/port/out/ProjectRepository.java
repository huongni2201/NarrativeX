package com.narrativex.backend.modules.project.application.port.out;

import com.narrativex.backend.modules.project.domain.aggregate.Project;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface ProjectRepository {
    Page<Project> findActiveByOwnerId(String ownerId, Pageable pageable);
    Optional<Project> findOwnedById(Long projectId, String ownerId);
    Optional<Project> findOwnedByIdForUpdate(Long projectId, String ownerId);
    Project save(Project project);
}
