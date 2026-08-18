package com.narrativex.backend.feature.storyboard.infrastructure.persistence.repository;

import com.narrativex.backend.feature.storyboard.infrastructure.persistence.entity.ChapterJpaEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChapterJpaRepository extends JpaRepository<ChapterJpaEntity, Long> {
  List<ChapterJpaEntity> findAllByStoryVersionIdOrderByOrderIndexAscIdAsc(Long storyVersionId);

  boolean existsByStoryVersionIdAndOrderIndex(Long storyVersionId, int orderIndex);
}
