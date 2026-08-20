package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.infrastructure.persistence.OptimisticConcurrency;
import com.narrativex.backend.feature.common.pagination.CursorCodec;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.common.pagination.OrderIndexCursorKey;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import com.narrativex.backend.feature.storyboard.domain.aggregate.Chapter;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.entity.ChapterJpaEntity;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mapper.ChapterPersistenceMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.repository.ChapterJpaRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

@Component
public class ChapterPersistenceAdapter implements ChapterRepository {
  private final ChapterJpaRepository repository;

  public ChapterPersistenceAdapter(ChapterJpaRepository repository) {
    this.repository = repository;
  }

  @Override
  public Chapter save(Chapter chapter) {
    return ChapterPersistenceMapper.toDomain(repository.save(toJpaEntity(chapter)));
  }

  @Override
  public Chapter saveAndFlush(Chapter chapter) {
    return ChapterPersistenceMapper.toDomain(repository.saveAndFlush(toJpaEntity(chapter)));
  }

  @Override
  public Optional<Chapter> findById(Long chapterId) {
    return repository.findById(chapterId).map(ChapterPersistenceMapper::toDomain);
  }

  @Override
  public List<Chapter> findAllByStoryVersionId(Long storyVersionId) {
    return repository.findAllByStoryVersionIdOrderByOrderIndexAscIdAsc(storyVersionId).stream()
        .map(ChapterPersistenceMapper::toDomain)
        .toList();
  }

  @Override
  public CursorPage<Chapter> findPageByStoryVersionId(
      Long storyVersionId, String cursor, int limit) {
    OrderIndexCursorKey cursorKey = CursorCodec.decodeOrderIndex(cursor);
    PageRequest fetchLimit = PageRequest.of(0, limit + 1);
    List<ChapterJpaEntity> entities =
        cursorKey == null
            ? repository.findFirstPageByStoryVersionId(storyVersionId, fetchLimit)
            : repository.findAfterByStoryVersionId(
                storyVersionId, cursorKey.orderIndex(), cursorKey.id(), fetchLimit);

    boolean hasNext = entities.size() > limit;
    List<ChapterJpaEntity> visibleEntities =
        entities.subList(0, Math.min(limit, entities.size()));
    String nextCursor =
        hasNext && !visibleEntities.isEmpty()
            ? CursorCodec.encode(
                visibleEntities.getLast().getOrderIndex(), visibleEntities.getLast().getId())
            : null;
    List<Chapter> content =
        visibleEntities.stream().map(ChapterPersistenceMapper::toDomain).toList();

    return new CursorPage<>(content, nextCursor, limit, hasNext);
  }

  @Override
  public boolean existsByStoryVersionIdAndOrderIndex(Long storyVersionId, int orderIndex) {
    return repository.existsByStoryVersionIdAndOrderIndex(storyVersionId, orderIndex);
  }

  private ChapterJpaEntity toJpaEntity(Chapter chapter) {
    if (chapter.getId() == null) {
      return ChapterJpaEntity.builder()
          .storyVersionId(chapter.getStoryVersionId())
          .orderIndex(chapter.getOrderIndex())
          .title(chapter.getTitle())
          .sourceText(chapter.getSourceText())
          .sourceHash(chapter.getSourceHash())
          .status("DRAFT")
          .generationProgress(0)
          .sourceStoryVersionId(chapter.getStoryVersionId())
          .build();
    }

    ChapterJpaEntity existing =
        repository
            .findById(chapter.getId())
            .orElseThrow(() -> new ResourceNotFoundException("Chapter was not found"));
    OptimisticConcurrency.requireVersion(
        chapter.getRowVersion(), existing.getRowVersion(), ChapterJpaEntity.class, chapter.getId());
    ChapterPersistenceMapper.apply(chapter, existing);
    return existing;
  }
}
