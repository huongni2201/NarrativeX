package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import com.narrativex.backend.feature.generation.application.port.out.ChapterContinuityRepository;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ChapterContinuityMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ContinuityBeatLineageRow;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.CurrentContinuityRow;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.RegenerationPlanRow;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisChapterContinuityPersistenceAdapter implements ChapterContinuityRepository {
  private static final TypeReference<List<UUID>> UUID_LIST_TYPE = new TypeReference<>() {};

  private final ChapterContinuityMapper mapper;
  private final ObjectMapper objectMapper;

  @Override
  public Optional<CurrentContinuity> findCurrent(UUID projectId, UUID chapterId) {
    CurrentContinuityRow row = mapper.findCurrent(projectId, chapterId);
    if (row == null) {
      return Optional.empty();
    }
    return Optional.of(
        new CurrentContinuity(
            row.getPlanId(),
            row.getPlanRevision(),
            row.getSourceHash(),
            row.getReportStatus(),
            row.getReportRevision(),
            row.getIssuesJson()));
  }

  @Override
  public List<BeatLineage> findBeatLineage(UUID planId) {
    List<ContinuityBeatLineageRow> rows = mapper.findBeatLineage(planId);
    if (rows == null || rows.isEmpty()) {
      return List.of();
    }
    return rows.stream()
        .map(
            row ->
                new BeatLineage(
                    row.getVisualBeatId(),
                    row.getSceneId(),
                    row.getSceneOrderIndex(),
                    row.getBeatOrderIndex(),
                    row.getSemanticHash()))
        .toList();
  }

  @Override
  public RegenerationPlan saveRegenerationPlan(RegenerationPlan plan) {
    mapper.insertRegenerationPlan(
        plan.id(),
        plan.projectId(),
        plan.chapterId(),
        plan.continuityPlanId(),
        plan.sourceHash(),
        writeUuidList(plan.requestedBeatIds()),
        writeUuidList(plan.affectedBeatIds()),
        writeUuidList(plan.reusableBeatIds()),
        plan.reason(),
        plan.expiresAt(),
        plan.inputFingerprint());
    return findRegenerationPlanByFingerprint(
            plan.projectId(), plan.chapterId(), plan.inputFingerprint())
        .orElseThrow(
            () -> new IllegalStateException("Regeneration plan replay could not be loaded"));
  }

  @Override
  public Optional<RegenerationPlan> findRegenerationPlan(
      UUID projectId, UUID chapterId, UUID planId) {
    return Optional.ofNullable(mapper.findRegenerationPlan(projectId, chapterId, planId))
        .map(this::toPlan);
  }

  @Override
  public Optional<RegenerationPlan> findRegenerationPlanByFingerprint(
      UUID projectId, UUID chapterId, String inputFingerprint) {
    return Optional.ofNullable(
            mapper.findRegenerationPlanByFingerprint(projectId, chapterId, inputFingerprint))
        .map(this::toPlan);
  }

  @Override
  public Optional<MediaGenerationSettings> findLatestMediaSettings(UUID chapterId) {
    var row = mapper.findLatestMediaSettings(chapterId);
    return row == null
        ? Optional.empty()
        : Optional.of(
            new MediaGenerationSettings(
                row.getAspectRatio(), row.getImageStyle(), row.getProviderKey(), row.getModelKey()));
  }

  @Override
  public void bindRegenerationJob(UUID generationJobId, UUID regenerationPlanId) {
    if (mapper.bindRegenerationJob(generationJobId, regenerationPlanId) != 1) {
      throw new IllegalStateException("Regeneration plan could not be bound to generation job");
    }
  }

  @Override
  public Optional<UUID> findRegenerationPlanIdForJob(UUID generationJobId) {
    return Optional.ofNullable(mapper.findRegenerationPlanIdForJob(generationJobId));
  }

  @Override
  public int nextReportRevision(UUID continuityPlanId) {
    return mapper.nextReportRevision(continuityPlanId);
  }

  @Override
  public void appendHumanReport(
      UUID continuityPlanId, int revision, String status, String issuesJson) {
    if (mapper.insertHumanReport(continuityPlanId, revision, status, issuesJson) != 1) {
      throw new IllegalStateException("Continuity report revision was not persisted");
    }
  }

  private RegenerationPlan toPlan(RegenerationPlanRow row) {
    return new RegenerationPlan(
        row.getId(),
        row.getProjectId(),
        row.getChapterId(),
        row.getContinuityPlanId(),
        row.getSourceHash(),
        readUuidList(row.getRequestedBeatIdsJson()),
        readUuidList(row.getAffectedBeatIdsJson()),
        readUuidList(row.getReusableBeatIdsJson()),
        row.getReason(),
        row.getExpiresAt(),
        row.getInputFingerprint());
  }

  private String writeUuidList(List<UUID> values) {
    try {
      return objectMapper.writeValueAsString(values == null ? List.of() : values);
    } catch (Exception exception) {
      throw new IllegalStateException("Failed to serialize UUID list", exception);
    }
  }

  private List<UUID> readUuidList(String rawJson) {
    if (rawJson == null || rawJson.isBlank()) {
      return List.of();
    }
    try {
      List<UUID> decoded = objectMapper.readValue(rawJson, UUID_LIST_TYPE);
      return decoded == null ? List.of() : Collections.unmodifiableList(decoded);
    } catch (Exception exception) {
      throw new IllegalStateException("Failed to deserialize UUID list", exception);
    }
  }
}
