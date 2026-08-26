package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.ChapterMediaHeadRepository;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ChapterMediaHeadMapper;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisChapterMediaHeadPersistenceAdapter implements ChapterMediaHeadRepository {
  private final ChapterMediaHeadMapper mapper;

  @Override
  public void setCurrent(UUID chapterId, UUID generationJobId) {
    if (mapper.upsert(chapterId, generationJobId) != 1) {
      throw new IllegalStateException(
          "Could not update current media job for chapter " + chapterId);
    }
  }

  @Override
  public Optional<UUID> findCurrentJobId(UUID chapterId) {
    return Optional.ofNullable(mapper.findCurrentJobId(chapterId));
  }

  @Override
  public boolean matchesCurrentPlan(UUID chapterId, UUID mediaPlanId, int mediaPlanRevision) {
    return mapper.matchesCurrentPlan(chapterId, mediaPlanId, mediaPlanRevision);
  }
}
