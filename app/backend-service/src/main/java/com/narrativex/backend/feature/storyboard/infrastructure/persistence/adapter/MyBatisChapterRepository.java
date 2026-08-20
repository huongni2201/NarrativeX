package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.pagination.CursorCodec;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.common.pagination.OrderIndexCursorKey;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import com.narrativex.backend.feature.storyboard.domain.aggregate.Chapter;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterRow;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class MyBatisChapterRepository implements ChapterRepository {
  private final ChapterMapper mapper;

  @Override
  @Transactional
  public Chapter save(Chapter chapter) {
    return persist(chapter);
  }

  @Override
  @Transactional
  public Chapter saveAndFlush(Chapter chapter) {
    return persist(chapter);
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<Chapter> findById(Long chapterId) {
    return Optional.ofNullable(mapper.findById(chapterId)).map(MyBatisChapterRepository::toDomain);
  }

  @Override
  @Transactional(readOnly = true)
  public List<Chapter> findAllByStoryVersionId(Long storyVersionId) {
    return mapper.findAllByStoryVersionId(storyVersionId).stream()
        .map(MyBatisChapterRepository::toDomain)
        .toList();
  }

  @Override
  @Transactional(readOnly = true)
  public CursorPage<Chapter> findPageByStoryVersionId(
      Long storyVersionId, String cursor, int limit) {
    OrderIndexCursorKey cursorKey = CursorCodec.decodeOrderIndex(cursor);
    int fetchLimit = limit + 1;
    List<ChapterRow> rows =
        cursorKey == null
            ? mapper.findFirstPageByStoryVersionId(storyVersionId, fetchLimit)
            : mapper.findAfterByStoryVersionId(
                storyVersionId, cursorKey.orderIndex(), cursorKey.id(), fetchLimit);

    boolean hasNext = rows.size() > limit;
    List<ChapterRow> visibleRows = rows.subList(0, Math.min(limit, rows.size()));
    String nextCursor =
        hasNext && !visibleRows.isEmpty()
            ? CursorCodec.encode(
                visibleRows.getLast().getOrderIndex(), visibleRows.getLast().getId())
            : null;
    return new CursorPage<>(
        visibleRows.stream().map(MyBatisChapterRepository::toDomain).toList(),
        nextCursor,
        limit,
        hasNext);
  }

  @Override
  @Transactional(readOnly = true)
  public boolean existsByStoryVersionIdAndOrderIndex(Long storyVersionId, int orderIndex) {
    return mapper.existsByStoryVersionIdAndOrderIndex(storyVersionId, orderIndex);
  }

  private Chapter persist(Chapter chapter) {
    if (chapter.getId() == null) {
      Long insertedId = mapper.insert(toInsertRow(chapter));
      if (insertedId == null) {
        throw new IllegalStateException("Inserted chapter did not return an id");
      }
      return findById(insertedId)
          .orElseThrow(() -> new IllegalStateException("Inserted chapter disappeared"));
    }

    if (mapper.findById(chapter.getId()) == null) {
      throw new ResourceNotFoundException("Chapter was not found");
    }
    if (mapper.update(toUpdateRow(chapter)) != 1) {
      throw new ObjectOptimisticLockingFailureException(Chapter.class, chapter.getId());
    }
    return findById(chapter.getId())
        .orElseThrow(
            () -> new ObjectOptimisticLockingFailureException(Chapter.class, chapter.getId()));
  }

  private static ChapterRow toInsertRow(Chapter chapter) {
    Instant now = Instant.now();
    return ChapterRow.builder()
        .rowVersion(0L)
        .createdAt(now)
        .updatedAt(now)
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

  private static ChapterRow toUpdateRow(Chapter chapter) {
    return ChapterRow.builder()
        .id(chapter.getId())
        .rowVersion(chapter.getRowVersion())
        .storyVersionId(chapter.getStoryVersionId())
        .orderIndex(chapter.getOrderIndex())
        .title(chapter.getTitle())
        .sourceText(chapter.getSourceText())
        .sourceHash(chapter.getSourceHash())
        .updatedAt(Instant.now())
        .build();
  }

  private static Chapter toDomain(ChapterRow row) {
    return Chapter.rehydrate(
        row.getId(),
        row.getRowVersion(),
        row.getStoryVersionId(),
        row.getOrderIndex(),
        row.getTitle(),
        row.getSourceText(),
        row.getSourceHash());
  }
}
