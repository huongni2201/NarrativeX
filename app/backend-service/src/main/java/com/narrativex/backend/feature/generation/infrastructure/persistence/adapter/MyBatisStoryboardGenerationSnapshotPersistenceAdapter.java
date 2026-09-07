package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.StoryboardGenerationSnapshotRepository;
import com.narrativex.backend.feature.generation.application.port.out.StoryboardGenerationSnapshotRepository.BeatSnapshot;
import com.narrativex.backend.feature.generation.application.port.out.StoryboardGenerationSnapshotRepository.ChapterScope;
import com.narrativex.backend.feature.generation.application.port.out.StoryboardGenerationSnapshotRepository.GenerationBatch;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.StoryboardGenerationBatchRow;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.StoryboardGenerationBeatSnapshotRow;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.StoryboardGenerationSnapshotMapper;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisStoryboardGenerationSnapshotPersistenceAdapter
    implements StoryboardGenerationSnapshotRepository {
  private final StoryboardGenerationSnapshotMapper mapper;

  @Override
  public Optional<ChapterScope> findCurrentScope(UUID projectId, UUID chapterId) {
    var row = mapper.findCurrentScope(projectId, chapterId);
    return row == null
        ? Optional.empty()
        : Optional.of(new ChapterScope(row.getStoryboardRevisionId(), row.getSourceHash()));
  }

  @Override
  public Optional<GenerationBatch> findByIdempotencyKey(
      UUID projectId, UUID chapterId, String idempotencyKey) {
    return toBatch(mapper.findBatchByIdempotencyKey(projectId, chapterId, idempotencyKey));
  }

  @Override
  public Optional<GenerationBatch> findById(UUID projectId, UUID chapterId, UUID batchId) {
    return toBatch(mapper.findBatchById(projectId, chapterId, batchId));
  }

  @Override
  public GenerationBatch save(GenerationBatch batch) {
    mapper.insertBatch(toRow(batch));
    for (BeatSnapshot beat : batch.beats()) {
      mapper.insertBeatSnapshot(toRow(batch.id(), beat));
    }
    return batch;
  }

  private Optional<GenerationBatch> toBatch(StoryboardGenerationBatchRow row) {
    if (row == null) return Optional.empty();
    List<BeatSnapshot> beats =
        mapper.findBeatSnapshots(row.getId()).stream().map(this::toBeat).toList();
    return Optional.of(
        new GenerationBatch(
            row.getId(),
            row.getProjectId(),
            row.getChapterId(),
            row.getStoryboardRevisionId(),
            row.getSourceHash(),
            row.getContinuityPlanId(),
            row.getContinuityPlanRevision(),
            row.getContinuityReportRevision(),
            row.getStylePolicyVersion(),
            row.getProviderPolicyVersion(),
            row.getIdempotencyKey(),
            row.getRequestFingerprint(),
            row.getIssuesJson(),
            row.getStatus(),
            row.getCreatedAt(),
            beats));
  }

  private static StoryboardGenerationBatchRow toRow(GenerationBatch batch) {
    var row = new StoryboardGenerationBatchRow();
    row.setId(batch.id());
    row.setProjectId(batch.projectId());
    row.setChapterId(batch.chapterId());
    row.setStoryboardRevisionId(batch.storyboardRevisionId());
    row.setSourceHash(batch.sourceHash());
    row.setContinuityPlanId(batch.continuityPlanId());
    row.setContinuityPlanRevision(batch.continuityPlanRevision());
    row.setContinuityReportRevision(batch.continuityReportRevision());
    row.setStylePolicyVersion(batch.stylePolicyVersion());
    row.setProviderPolicyVersion(batch.providerPolicyVersion());
    row.setIdempotencyKey(batch.idempotencyKey());
    row.setRequestFingerprint(batch.requestFingerprint());
    row.setIssuesJson(batch.issuesJson());
    row.setStatus(batch.status());
    row.setCreatedAt(batch.createdAt());
    return row;
  }

  private static StoryboardGenerationBeatSnapshotRow toRow(UUID batchId, BeatSnapshot beat) {
    var row = new StoryboardGenerationBeatSnapshotRow();
    row.setId(beat.id());
    row.setBatchId(batchId);
    row.setVisualBeatId(beat.visualBeatId());
    row.setSceneId(beat.sceneId());
    row.setBeatRowVersion(beat.beatRowVersion());
    row.setPrompt(beat.prompt());
    row.setNegativePrompt(beat.negativePrompt());
    row.setCharacterSnapshotJson(beat.characterSnapshotJson());
    row.setReferencesJson(beat.referencesJson());
    row.setContinuitySemanticHash(beat.continuitySemanticHash());
    row.setInputFingerprint(beat.inputFingerprint());
    return row;
  }

  private BeatSnapshot toBeat(StoryboardGenerationBeatSnapshotRow row) {
    return new BeatSnapshot(
        row.getId(),
        row.getVisualBeatId(),
        row.getSceneId(),
        row.getBeatRowVersion(),
        row.getPrompt(),
        row.getNegativePrompt(),
        row.getCharacterSnapshotJson(),
        row.getReferencesJson(),
        row.getContinuitySemanticHash(),
        row.getInputFingerprint());
  }
}
