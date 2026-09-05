package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.ChapterContinuityRepository;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ChapterContinuityMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.CurrentContinuityRow;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.RegenerationPlanRow;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
@RequiredArgsConstructor
public class MyBatisChapterContinuityPersistenceAdapter implements ChapterContinuityRepository {
  private final ChapterContinuityMapper mapper;
  private final ObjectMapper objectMapper;

  @Override
  public Optional<CurrentContinuity> findCurrent(UUID projectId, UUID chapterId) {
    CurrentContinuityRow row = mapper.findCurrent(projectId, chapterId);
    return row == null
        ? Optional.empty()
        : Optional.of(
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
    return mapper.findBeatLineage(planId).stream()
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
    int inserted =
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
            plan.estimatedCost(),
            plan.currency(),
            plan.expiresAt(),
            plan.inputFingerprint(),
            plan.createdBy());
    if (inserted == 1) return plan;
    return findRegenerationPlanByFingerprint(
            plan.projectId(), plan.chapterId(), plan.inputFingerprint())
        .orElseThrow(() -> new IllegalStateException("Regeneration plan replay could not be loaded"));
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
                row.getAspectRatio(),
                row.getImageStyle(),
                row.getProviderKey(),
                row.getModelKey(),
                row.getPricingSnapshotJson(),
                row.getPricingFingerprint()));
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
      UUID continuityPlanId,
      int revision,
      String status,
      String issuesJson,
      String reviewedBy) {
    if (mapper.insertHumanReport(continuityPlanId, revision, status, issuesJson, reviewedBy) != 1) {
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
        row.getEstimatedCost(),
        row.getCurrency(),
        row.getExpiresAt(),
        row.getInputFingerprint(),
        row.getCreatedBy());
  }

  private String writeUuidList(List<UUID> values) {
    try {
      return objectMapper.writeValueAsString(values.stream().map(UUID::toString).toList());
    } catch (Exception exception) {
      throw new IllegalStateException("Could not serialize regeneration beat ids", exception);
    }
  }

  private List<UUID> readUuidList(String value) {
    try {
      String[] ids = objectMapper.readValue(value, String[].class);
      return Arrays.stream(ids).map(UUID::fromString).toList();
    } catch (Exception exception) {
      throw new IllegalStateException("Could not parse regeneration beat ids", exception);
    }
  }
}
