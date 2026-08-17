package com.narrativex.backend.modules.character.infrastructure.persistence.repository;

import com.narrativex.backend.modules.character.infrastructure.persistence.entity.CharacterVersionJpaEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CharacterVersionJpaRepository extends JpaRepository<CharacterVersionJpaEntity, Long> {
    int countByCharacterId(Long characterId);

    @Query("select version from CharacterVersionJpaEntity version, CharacterJpaEntity character "
        + "where version.id = :versionId and version.characterId = character.id "
        + "and character.ownerId = :ownerId")
    Optional<CharacterVersionJpaEntity> findOwnedById(@Param("versionId") Long versionId,
                                                       @Param("ownerId") String ownerId);
}
