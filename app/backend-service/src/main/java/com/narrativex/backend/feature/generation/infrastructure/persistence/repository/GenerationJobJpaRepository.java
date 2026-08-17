package com.narrativex.backend.feature.generation.infrastructure.persistence.repository;

import com.narrativex.backend.feature.generation.infrastructure.persistence.entity.GenerationJobJpaEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GenerationJobJpaRepository extends JpaRepository<GenerationJobJpaEntity, Long> {

    @Query(value = "select j.* from generation_jobs j join projects p on p.id = j.project_id "
        + "where j.job_id = :jobId and p.owner_id = :ownerId and p.archived_at is null",
        nativeQuery = true)
    Optional<GenerationJobJpaEntity> findByJobIdAndOwner(@Param("jobId") String jobId,
                                                         @Param("ownerId") String ownerId);
}
