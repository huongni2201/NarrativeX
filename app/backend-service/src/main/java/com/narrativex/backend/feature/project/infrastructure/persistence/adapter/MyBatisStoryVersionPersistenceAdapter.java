package com.narrativex.backend.feature.project.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.infrastructure.persistence.OptimisticConcurrency;
import com.narrativex.backend.feature.project.application.port.out.StoryVersionRepository;
import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import com.narrativex.backend.feature.project.domain.enums.ModerationDecision;
import com.narrativex.backend.feature.project.domain.enums.StoryVersionStatus;
import com.narrativex.backend.feature.project.infrastructure.persistence.mybatis.StoryVersionMapper;
import com.narrativex.backend.feature.project.infrastructure.persistence.mybatis.StoryVersionRow;
import java.time.Instant;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisStoryVersionPersistenceAdapter implements StoryVersionRepository {
  private final StoryVersionMapper mapper;
  @Override public int findMaxVersionNumberByProjectId(Long id) { return mapper.maxVersion(id); }
  @Override public Optional<StoryVersion> findByIdAndProjectId(Long id, Long projectId) { return Optional.ofNullable(mapper.findByIdAndProject(id, projectId)).map(MyBatisStoryVersionPersistenceAdapter::toDomain); }
  @Override public Optional<StoryVersion> findActiveByProjectId(Long id) { return Optional.ofNullable(mapper.findActive(id, StoryVersionStatus.ACTIVE.name())).map(MyBatisStoryVersionPersistenceAdapter::toDomain); }
  @Override public Optional<StoryVersion> findLatestByProjectId(Long id) { return Optional.ofNullable(mapper.findLatest(id)).map(MyBatisStoryVersionPersistenceAdapter::toDomain); }
  @Override public StoryVersion save(StoryVersion value) { return persist(value); }
  @Override public StoryVersion saveAndFlush(StoryVersion value) { return persist(value); }
  private StoryVersion persist(StoryVersion value) {
    Instant now = Instant.now(); StoryVersionRow row = new StoryVersionRow(); row.setId(value.getId()); row.setRowVersion(value.getRowVersion()); row.setCreatedAt(now); row.setUpdatedAt(now); row.setProjectId(value.getProjectId()); row.setVersionNumber(value.getVersionNumber()); row.setContent(value.getContent()); row.setSourceLanguage(value.getSourceLanguage()); row.setStatus(value.getStatus().name()); row.setModerationDecision(value.getModerationDecision().name());
    if (value.getId() == null) { Long id = mapper.insert(row); return toDomain(mapper.findById(id)); }
    StoryVersionRow existing = mapper.findById(value.getId());
    if (existing == null) throw new ResourceNotFoundException("Story version was not found");
    OptimisticConcurrency.requireVersion(value.getRowVersion(), existing.getRowVersion(), StoryVersion.class, value.getId());
    if (mapper.update(row) != 1) throw new org.springframework.dao.OptimisticLockingFailureException("Story version was modified concurrently");
    return toDomain(mapper.findById(value.getId()));
  }
  private static StoryVersion toDomain(StoryVersionRow row) { return StoryVersion.rehydrate(row.getId(),row.getRowVersion(),row.getProjectId(),row.getVersionNumber(),row.getContent(),row.getSourceLanguage(),StoryVersionStatus.valueOf(row.getStatus()),ModerationDecision.valueOf(row.getModerationDecision())); }
}
