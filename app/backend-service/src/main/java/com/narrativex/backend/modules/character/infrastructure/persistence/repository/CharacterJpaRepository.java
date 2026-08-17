package com.narrativex.backend.modules.character.infrastructure.persistence.repository;

import com.narrativex.backend.modules.character.infrastructure.persistence.entity.CharacterJpaEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CharacterJpaRepository extends JpaRepository<CharacterJpaEntity, Long> {
    Optional<CharacterJpaEntity> findByIdAndOwnerIdAndStatusNot(Long id, String ownerId,
                                                                  com.narrativex.backend.modules.character.domain.model.CharacterStatus status);
}
