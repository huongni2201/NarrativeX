package com.narrativex.backend.feature.storyboard.infrastructure.persistence.repository;

import com.narrativex.backend.feature.storyboard.infrastructure.persistence.entity.SceneJpaEntity;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SceneJpaRepository extends JpaRepository<SceneJpaEntity, Long> {
  List<SceneJpaEntity> findAllByChapterIdOrderByOrderIndexAscIdAsc(Long chapterId);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query(
      "select scene from SceneJpaEntity scene "
          + "where scene.id = :sceneId and scene.chapterId = :chapterId")
  Optional<SceneJpaEntity> findByIdAndChapterIdForUpdate(
      @Param("sceneId") Long sceneId, @Param("chapterId") Long chapterId);
}
