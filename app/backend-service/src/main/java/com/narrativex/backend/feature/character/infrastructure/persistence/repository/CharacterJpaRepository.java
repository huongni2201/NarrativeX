package com.narrativex.backend.feature.character.infrastructure.persistence.repository;

import com.narrativex.backend.feature.character.domain.enums.CharacterStatus;
import com.narrativex.backend.feature.character.infrastructure.persistence.entity.CharacterJpaEntity;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CharacterJpaRepository extends JpaRepository<CharacterJpaEntity, Long> {
    Optional<CharacterJpaEntity> findByIdAndOwnerIdAndStatusNot(Long id, String ownerId, CharacterStatus status);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select character from CharacterJpaEntity character where character.id = :characterId and character.ownerId = :ownerId and character.status <> :archivedStatus")
    Optional<CharacterJpaEntity> findOwnedByIdForUpdate(@Param("characterId") Long characterId, @Param("ownerId") String ownerId, @Param("archivedStatus") CharacterStatus archivedStatus);
}
