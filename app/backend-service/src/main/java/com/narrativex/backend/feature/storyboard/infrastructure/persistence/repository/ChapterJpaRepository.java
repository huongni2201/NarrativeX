package com.narrativex.backend.feature.storyboard.infrastructure.persistence.repository;

import com.narrativex.backend.feature.storyboard.infrastructure.persistence.entity.ChapterJpaEntity;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChapterJpaRepository extends JpaRepository<ChapterJpaEntity, Long> {
  List<ChapterJpaEntity> findAllByStoryVersionIdOrderByOrderIndexAscIdAsc(Long storyVersionId);

  @Query(
      "select chapter from ChapterJpaEntity chapter "
          + "where chapter.storyVersionId = :storyVersionId "
          + "order by chapter.orderIndex asc, chapter.id asc")
  List<ChapterJpaEntity> findFirstPageByStoryVersionId(
      @Param("storyVersionId") Long storyVersionId, Pageable pageable);

  @Query(
      "select chapter from ChapterJpaEntity chapter "
          + "where chapter.storyVersionId = :storyVersionId "
          + "and (chapter.orderIndex > :orderIndex "
          + "or (chapter.orderIndex = :orderIndex and chapter.id > :id)) "
          + "order by chapter.orderIndex asc, chapter.id asc")
  List<ChapterJpaEntity> findAfterByStoryVersionId(
      @Param("storyVersionId") Long storyVersionId,
      @Param("orderIndex") int orderIndex,
      @Param("id") Long id,
      Pageable pageable);

  boolean existsByStoryVersionIdAndOrderIndex(Long storyVersionId, int orderIndex);
}
