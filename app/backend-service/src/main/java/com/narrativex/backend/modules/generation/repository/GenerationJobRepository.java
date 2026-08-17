package com.narrativex.backend.modules.generation.repository;

import com.narrativex.backend.modules.generation.domain.GenerationJob;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GenerationJobRepository extends JpaRepository<GenerationJob, Long> {
    Optional<GenerationJob> findByJobId(String jobId);
    Optional<GenerationJob> findByJobIdAndProjectOwnerId(String jobId, String ownerId);
}
