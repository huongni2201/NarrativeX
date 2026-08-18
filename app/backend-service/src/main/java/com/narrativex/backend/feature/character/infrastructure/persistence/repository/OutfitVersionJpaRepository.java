package com.narrativex.backend.feature.character.infrastructure.persistence.repository;

import com.narrativex.backend.feature.character.domain.enums.CharacterStatus;
import com.narrativex.backend.feature.character.infrastructure.persistence.entity.OutfitVersionJpaEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OutfitVersionJpaRepository extends JpaRepository<OutfitVersionJpaEntity, Long> {
  @Query(
      "select coalesce(max(outfit.versionNumber), 0) from OutfitVersionJpaEntity outfit where outfit.characterId = :characterId")
  int findMaxVersionNumberByCharacterId(@Param("characterId") Long characterId);

  @Query(
      "select outfit from OutfitVersionJpaEntity outfit, CharacterJpaEntity character where outfit.id = :outfitVersionId and outfit.characterId = character.id and character.ownerId = :ownerId and character.status <> :archivedStatus")
  Optional<OutfitVersionJpaEntity> findOwnedById(
      @Param("outfitVersionId") Long id,
      @Param("ownerId") String ownerId,
      @Param("archivedStatus") CharacterStatus archivedStatus);
}
