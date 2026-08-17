package com.narrativex.backend.modules.generation.infrastructure.persistence;

import com.narrativex.backend.modules.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.modules.generation.domain.model.GenerationJob;
import com.narrativex.backend.modules.generation.infrastructure.persistence.entity.GenerationJobJpaEntity;
import com.narrativex.backend.modules.generation.infrastructure.persistence.repository.GenerationJobJpaRepository;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class GenerationJobPersistenceAdapter implements GenerationJobRepository {

    private final GenerationJobJpaRepository repository;

    public GenerationJobPersistenceAdapter(GenerationJobJpaRepository repository) {
        this.repository = repository;
    }

    @Override
    public GenerationJob save(GenerationJob job) {
        GenerationJobJpaEntity entity = job.getId() == null
            ? new GenerationJobJpaEntity(job)
            : repository.findById(job.getId()).orElseGet(() -> new GenerationJobJpaEntity(job));
        entity.apply(job);
        return GenerationPersistenceMapper.toDomain(repository.save(entity));
    }

    @Override
    public Optional<GenerationJob> findByJobIdAndOwner(String jobId, String ownerId) {
        return repository.findByJobIdAndOwner(jobId, ownerId).map(GenerationPersistenceMapper::toDomain);
    }
}
