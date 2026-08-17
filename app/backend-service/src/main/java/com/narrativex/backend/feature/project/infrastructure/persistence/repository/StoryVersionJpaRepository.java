package com.narrativex.backend.feature.project.infrastructure.persistence.repository;

import com.narrativex.backend.feature.project.infrastructure.persistence.entity.StoryVersionJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StoryVersionJpaRepository extends JpaRepository<StoryVersionJpaEntity, Long> {
    @Query("select coalesce(max(version.versionNumber), 0) from StoryVersionJpaEntity version "
        + "where version.projectId = :projectId")
    int findMaxVersionNumberByProjectId(@Param("projectId") Long projectId);
}
