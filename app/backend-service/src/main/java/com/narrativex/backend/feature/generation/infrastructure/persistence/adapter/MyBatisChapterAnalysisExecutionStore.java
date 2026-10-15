package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.model.analysis.AnalysisProviderCredential;
import com.narrativex.backend.feature.generation.application.model.analysis.AnalysisRuntimeConfiguration;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisExecutionAttempt;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisExecutionProfile;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisExecutionSnapshot;
import com.narrativex.backend.feature.generation.application.port.out.ChapterAnalysisExecutionStore;
import com.narrativex.backend.feature.generation.domain.enums.ChapterAnalysisAttemptCheckpoint;
import com.narrativex.backend.feature.generation.domain.enums.ChapterAnalysisExecutionMode;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.AnalysisProviderCredentialRow;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.AnalysisRuntimeConfigurationRow;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ChapterAnalysisExecutionAttemptRow;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ChapterAnalysisExecutionMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ChapterAnalysisExecutionSnapshotRow;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
@RequiredArgsConstructor
public class MyBatisChapterAnalysisExecutionStore implements ChapterAnalysisExecutionStore {
  private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};

  private final ChapterAnalysisExecutionMapper mapper;
  private final ObjectMapper objectMapper;

  @Override
  public AnalysisRuntimeConfiguration findRuntimeConfiguration() {
    AnalysisRuntimeConfigurationRow row = mapper.findRuntimeConfiguration();
    if (row == null) throw new IllegalStateException("Analysis runtime configuration is missing");
    return toRuntimeConfiguration(row);
  }

  @Override
  public Optional<AnalysisRuntimeConfiguration> updateRuntimeConfiguration(
      AnalysisRuntimeConfiguration desired, long expectedRowVersion) {
    int updated = mapper.updateRuntimeConfiguration(toRow(desired), expectedRowVersion);
    return updated == 0 ? Optional.empty() : Optional.of(findRuntimeConfiguration());
  }

  @Override
  public Optional<AnalysisProviderCredential> findCredential(UUID credentialRef) {
    return Optional.ofNullable(mapper.findCredential(credentialRef)).map(this::toCredential);
  }

  @Override
  public Optional<AnalysisProviderCredential> findCredentialByDevice(UUID deviceId) {
    return Optional.ofNullable(mapper.findCredentialByDevice(deviceId)).map(this::toCredential);
  }

  @Override
  public AnalysisProviderCredential insertCredential(AnalysisProviderCredential credential) {
    if (mapper.insertCredential(toRow(credential)) != 1) {
      throw new IllegalStateException("Provider credential metadata was not inserted");
    }
    return findCredential(credential.credentialRef())
        .orElseThrow(
            () -> new IllegalStateException("Inserted provider credential could not be read"));
  }

  @Override
  public Optional<AnalysisProviderCredential> updateCredential(
      AnalysisProviderCredential credential, long expectedRowVersion) {
    int updated = mapper.updateCredential(toRow(credential), expectedRowVersion);
    return updated == 0 ? Optional.empty() : findCredential(credential.credentialRef());
  }

  @Override
  public ChapterAnalysisExecutionSnapshot saveSnapshot(ChapterAnalysisExecutionSnapshot snapshot) {
    mapper.insertSnapshot(toRow(snapshot));
    ChapterAnalysisExecutionSnapshot saved =
        findSnapshot(snapshot.generationJobId())
            .orElseThrow(
                () -> new IllegalStateException("Analysis execution snapshot was not stored"));
    if (!sameSnapshot(snapshot, saved)) {
      throw new IllegalStateException(
          "Analysis execution snapshot conflicts with its immutable row");
    }
    return saved;
  }

  @Override
  public Optional<ChapterAnalysisExecutionSnapshot> findSnapshot(UUID generationJobId) {
    return Optional.ofNullable(mapper.findSnapshot(generationJobId)).map(this::toSnapshot);
  }

  @Override
  public ChapterAnalysisExecutionAttempt insertAttempt(ChapterAnalysisExecutionAttempt attempt) {
    mapper.insertAttempt(ChapterAnalysisExecutionAttemptRow.from(attempt));
    ChapterAnalysisExecutionAttempt saved =
        findAttemptByClaimRequest(attempt.deviceId(), attempt.claimRequestId())
            .orElseThrow(() -> new IllegalStateException("Analysis attempt was not stored"));
    if (!saved.generationJobId().equals(attempt.generationJobId())
        || !saved.inputFingerprint().equals(attempt.inputFingerprint())
        || !saved.credentialRef().equals(attempt.credentialRef())
        || saved.credentialGeneration() != attempt.credentialGeneration()) {
      throw new IllegalStateException("Claim request was replayed for a different analysis input");
    }
    return saved;
  }

  @Override
  public Optional<ChapterAnalysisExecutionAttempt> findAttempt(UUID attemptId) {
    return Optional.ofNullable(mapper.findAttempt(attemptId)).map(this::toAttempt);
  }

  @Override
  public Optional<ChapterAnalysisExecutionAttempt> findAttemptByClaimRequest(
      UUID deviceId, UUID claimRequestId) {
    return Optional.ofNullable(mapper.findAttemptByClaimRequest(deviceId, claimRequestId))
        .map(this::toAttempt);
  }

  @Override
  public Optional<ChapterAnalysisExecutionAttempt> findActiveAttempt(UUID generationJobId) {
    return Optional.ofNullable(mapper.findActiveAttempt(generationJobId)).map(this::toAttempt);
  }

  @Override
  public boolean updateAttempt(
      ChapterAnalysisExecutionAttempt attempt, long expectedRowVersion, long expectedFencingToken) {
    return mapper.updateAttempt(
            ChapterAnalysisExecutionAttemptRow.from(attempt),
            expectedRowVersion,
            expectedFencingToken)
        == 1;
  }

  private AnalysisRuntimeConfiguration toRuntimeConfiguration(AnalysisRuntimeConfigurationRow row) {
    // The installed agy CLI is the only chapter-analysis runner.
    return new AnalysisRuntimeConfiguration(
        row.getRevision(),
        ChapterAnalysisExecutionMode.ANTIGRAVITY_CLI,
        row.getModel(),
        row.getEffort(),
        row.getMaxConcurrentAnalyses(),
        row.getMaxQueuedAnalyses(),
        row.getMaxInputBytes(),
        row.getMaxOutputBytes(),
        row.getMaxRuntimeMs(),
        row.getRowVersion());
  }

  private AnalysisRuntimeConfigurationRow toRow(AnalysisRuntimeConfiguration value) {
    AnalysisRuntimeConfigurationRow row = new AnalysisRuntimeConfigurationRow();
    row.setRevision(value.revision());
    row.setExecutionMode(value.executionMode().name());
    row.setModel(value.model());
    row.setEffort(value.effort());
    row.setMaxConcurrentAnalyses(value.maxConcurrentAnalyses());
    row.setMaxQueuedAnalyses(value.maxQueuedAnalyses());
    row.setMaxInputBytes(value.maxInputBytes());
    row.setMaxOutputBytes(value.maxOutputBytes());
    row.setMaxRuntimeMs(value.maxRuntimeMs());
    row.setRowVersion(value.rowVersion());
    return row;
  }

  private AnalysisProviderCredential toCredential(AnalysisProviderCredentialRow row) {
    return new AnalysisProviderCredential(
        row.getCredentialRef(),
        row.getDeviceId(),
        row.getConnectionFingerprint(),
        row.getCredentialGeneration(),
        row.getLabel(),
        row.getObservedConnectionState(),
        row.getAdapterVersion(),
        readStringList(row.getModelCapabilitiesJson()),
        row.getObservedQuotaState(),
        row.getQuotaObservedAt(),
        row.getNextEligibleAt(),
        row.getRuntimeEpoch(),
        row.getObservationSequence(),
        row.getRowVersion());
  }

  private AnalysisProviderCredentialRow toRow(AnalysisProviderCredential value) {
    AnalysisProviderCredentialRow row = new AnalysisProviderCredentialRow();
    row.setCredentialRef(value.credentialRef());
    row.setDeviceId(value.deviceId());
    row.setConnectionFingerprint(value.connectionFingerprint());
    row.setCredentialGeneration(value.credentialGeneration());
    row.setLabel(value.label());
    row.setObservedConnectionState(value.observedConnectionState());
    row.setAdapterVersion(value.adapterVersion());
    row.setModelCapabilitiesJson(write(value.modelCapabilities()));
    row.setObservedQuotaState(value.observedQuotaState());
    row.setQuotaObservedAt(value.quotaObservedAt());
    row.setNextEligibleAt(value.nextEligibleAt());
    row.setRuntimeEpoch(value.runtimeEpoch());
    row.setObservationSequence(value.observationSequence());
    row.setRowVersion(value.rowVersion());
    return row;
  }

  private ChapterAnalysisExecutionSnapshotRow toRow(ChapterAnalysisExecutionSnapshot value) {
    ChapterAnalysisExecutionSnapshotRow row = new ChapterAnalysisExecutionSnapshotRow();
    row.setGenerationJobId(value.generationJobId());
    row.setExecutionMode(value.profile().executionMode().name());
    row.setProfileJson(write(value.profile()));
    row.setPromptVersion(value.profile().promptVersion());
    row.setPromptHash(value.profile().promptHash());
    row.setPromptTemplate(value.promptTemplate());
    row.setSchemaVersion(value.profile().schemaVersion());
    row.setSchemaHash(value.profile().schemaHash());
    row.setResponseSchemaJson(write(value.responseSchema()));
    row.setInputFingerprint(value.inputFingerprint());
    row.setConfigRevision(value.configRevision());
    row.setCreatedAt(value.createdAt());
    return row;
  }

  private ChapterAnalysisExecutionSnapshot toSnapshot(ChapterAnalysisExecutionSnapshotRow row) {
    return new ChapterAnalysisExecutionSnapshot(
        row.getGenerationJobId(),
        read(row.getProfileJson(), ChapterAnalysisExecutionProfile.class),
        row.getPromptTemplate(),
        readTree(row.getResponseSchemaJson()),
        row.getInputFingerprint(),
        row.getConfigRevision(),
        row.getCreatedAt());
  }

  private ChapterAnalysisExecutionAttempt toAttempt(ChapterAnalysisExecutionAttemptRow row) {
    return new ChapterAnalysisExecutionAttempt(
        row.getAttemptId(),
        row.getGenerationJobId(),
        row.getAttemptNumber(),
        row.getClaimRequestId(),
        row.getDeviceId(),
        row.getCredentialRef(),
        row.getCredentialGeneration(),
        row.getInputFingerprint(),
        ChapterAnalysisAttemptCheckpoint.valueOf(row.getCheckpoint()),
        row.getLeaseTokenHash(),
        row.getLeaseExpiresAt(),
        row.getFencingToken(),
        row.getLastObservationSequence(),
        row.getSubmissionIntentId(),
        row.getConversationId(),
        row.getOutputHash(),
        row.getCompletionPayloadHash(),
        row.getTerminalReason(),
        row.isSlotHeld(),
        row.getRowVersion(),
        row.getCreatedAt(),
        row.getUpdatedAt());
  }

  private static boolean sameSnapshot(
      ChapterAnalysisExecutionSnapshot expected, ChapterAnalysisExecutionSnapshot saved) {
    return expected.generationJobId().equals(saved.generationJobId())
        && expected.profile().equals(saved.profile())
        && expected.promptTemplate().equals(saved.promptTemplate())
        && expected.responseSchema().equals(saved.responseSchema())
        && expected.inputFingerprint().equals(saved.inputFingerprint())
        && expected.configRevision() == saved.configRevision();
  }

  private List<String> readStringList(String json) {
    if (json == null || json.isBlank()) return List.of();
    try {
      List<String> values = objectMapper.readValue(json, STRING_LIST);
      return values == null ? List.of() : List.copyOf(values);
    } catch (Exception exception) {
      throw new IllegalStateException("Could not read analysis model capabilities", exception);
    }
  }

  private <T> T read(String json, Class<T> type) {
    try {
      return objectMapper.readValue(json, type);
    } catch (Exception exception) {
      throw new IllegalStateException("Could not read chapter analysis execution JSON", exception);
    }
  }

  private JsonNode readTree(String json) {
    try {
      return objectMapper.readTree(json);
    } catch (Exception exception) {
      throw new IllegalStateException("Could not read chapter analysis schema JSON", exception);
    }
  }

  private String write(Object value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (Exception exception) {
      throw new IllegalStateException("Could not write chapter analysis execution JSON", exception);
    }
  }
}
