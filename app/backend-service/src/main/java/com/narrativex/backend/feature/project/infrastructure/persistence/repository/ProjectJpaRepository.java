package com.narrativex.backend.feature.project.infrastructure.persistence.repository;

import com.narrativex.backend.feature.project.infrastructure.persistence.entity.ProjectJpaEntity;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProjectJpaRepository extends JpaRepository<ProjectJpaEntity, Long> {
    Page<ProjectJpaEntity> findByOwnerIdAndArchivedAtIsNullOrderByUpdatedAtDesc(
        String ownerId, Pageable pageable);
    Optional<ProjectJpaEntity> findByIdAndOwnerIdAndArchivedAtIsNull(Long id, String ownerId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select project from ProjectJpaEntity project "
        + "where project.id = :projectId and project.ownerId = :ownerId "
        + "and project.archivedAt is null")
    Optional<ProjectJpaEntity> findOwnedByIdForUpdate(@Param("projectId") Long projectId,
                                                      @Param("ownerId") String ownerId);
}
