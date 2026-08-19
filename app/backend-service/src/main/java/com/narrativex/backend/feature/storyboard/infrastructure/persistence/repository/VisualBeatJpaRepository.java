package com.narrativex.backend.feature.storyboard.infrastructure.persistence.repository;

import com.narrativex.backend.feature.storyboard.infrastructure.persistence.entity.VisualBeatJpaEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VisualBeatJpaRepository extends JpaRepository<VisualBeatJpaEntity, Long> {
  List<VisualBeatJpaEntity> findAllBySceneIdInOrderBySceneIdAscOrderIndexAscIdAsc(
      List<Long> sceneIds);

  @Query(
      "select coalesce(max(beat.orderIndex), -1) from VisualBeatJpaEntity beat "
          + "where beat.sceneId = :sceneId")
  int findMaxOrderIndexBySceneId(@Param("sceneId") Long sceneId);
}
