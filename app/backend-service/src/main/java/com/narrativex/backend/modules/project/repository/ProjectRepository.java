package com.narrativex.backend.modules.project.repository;

import com.narrativex.backend.modules.project.domain.Project;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectRepository extends JpaRepository<Project, Long> {
    List<Project> findByOwnerIdAndArchivedAtIsNullOrderByUpdatedAtDesc(String ownerId);
    Optional<Project> findByIdAndOwnerIdAndArchivedAtIsNull(Long id, String ownerId);
}
