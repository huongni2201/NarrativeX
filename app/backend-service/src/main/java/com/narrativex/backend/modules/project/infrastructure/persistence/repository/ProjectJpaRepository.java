package com.narrativex.backend.modules.project.infrastructure.persistence.repository;

import com.narrativex.backend.modules.project.infrastructure.persistence.entity.ProjectJpaEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectJpaRepository extends JpaRepository<ProjectJpaEntity, Long> {
    List<ProjectJpaEntity> findByOwnerIdAndArchivedAtIsNullOrderByUpdatedAtDesc(String ownerId);
    Optional<ProjectJpaEntity> findByIdAndOwnerIdAndArchivedAtIsNull(Long id, String ownerId);
}
