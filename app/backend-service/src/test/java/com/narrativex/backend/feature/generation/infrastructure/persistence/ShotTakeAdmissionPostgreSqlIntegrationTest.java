package com.narrativex.backend.feature.generation.infrastructure.persistence;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.narrativex.backend.configuration.NarrativeXLimitsProperties;
import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.generation.api.response.TakeResponse;
import com.narrativex.backend.feature.generation.application.command.GenerateShotTakeCommand;
import com.narrativex.backend.feature.generation.application.model.TakeInputSnapshot;
import com.narrativex.backend.feature.generation.application.model.compute.*;
import com.narrativex.backend.feature.generation.application.port.out.*;
import com.narrativex.backend.feature.generation.application.service.GenerationJobTransactionService;
import com.narrativex.backend.feature.generation.application.usecase.GenerateShotTakeUseCase;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import com.narrativex.backend.feature.generation.infrastructure.compute.VideoGenerationProperties;
import com.narrativex.backend.feature.generation.infrastructure.dispatch.VideoGenerationJobHandler;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.TakeMapper;
import com.narrativex.backend.support.PostgreSqlIntegrationTestSupport;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@ActiveProfiles("test")
class ShotTakeAdmissionPostgreSqlIntegrationTest extends PostgreSqlIntegrationTestSupport {
  @Autowired GenerateShotTakeUseCase admission;
  @Autowired GenerationJobRepository jobs;
  @Autowired TakeRepository takes;
  @Autowired TakeMapper takeMapper;
  @Autowired GenerationJobTransactionService transactions;
  @Autowired NarrativeXLimitsProperties limits;
  @Autowired VideoGenerationProperties video;
  @Autowired JdbcTemplate jdbc;

  @Autowired
  com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ShotMapper shots;

  @Autowired
  com.narrativex.backend.feature.generation.infrastructure.dispatch.GenerationJobHandlerRegistry
      handlers;

  @Autowired
  com.narrativex.backend.feature.generation.infrastructure.dispatch.VideoGenerationJobHandler
      videoHandler;

  @Autowired
  com.narrativex.backend.feature.generation.application.service.ComputeResultFinalizerRegistry
      finalizers;

  @Autowired
  com.narrativex.backend.feature.generation.infrastructure.finalizer.VideoGenerationResultFinalizer
      videoFinalizer;

  UUID projectId, chapterId, beatId, storyBeatId, shotId;
  JsonMapper json = JsonMapper.builder().build();

  @BeforeEach
  void seed() {
    jdbc.update(
        "UPDATE generation_jobs SET status = 'COMPLETED' WHERE idempotency_key LIKE 'shot-take:%'");
    limits.setMaxConcurrentExpensiveJobs(100);
    video.setDefaultProvider("ltx");
    video.setDefaultModel("ltx-2.5-nvfp4");
    projectId =
        id(
            "INSERT INTO projects(name,status,source_language,narration_language,metadata_language,image_aspect_ratio) VALUES ('admission','DRAFT','en','en','en','RATIO_16_9') RETURNING id");
    UUID story =
        id(
            "INSERT INTO story_versions(project_id,version_number,content,source_language,status) VALUES (?,1,'Saved script','en','ACTIVE') RETURNING id",
            projectId);
    chapterId =
        id(
            "INSERT INTO chapters(story_version_id,order_index,title,source_text,source_hash) VALUES (?,1,'Chapter','Saved script',?) RETURNING id",
            story,
            "a".repeat(64));
    UUID revision =
        id(
            "INSERT INTO storyboard_revisions(chapter_id,revision_number,source_hash,source_row_version) VALUES (?,1,?,0) RETURNING id",
            chapterId,
            "a".repeat(64));
    jdbc.update(
        "UPDATE chapters SET current_storyboard_revision_id = ? WHERE id = ?", revision, chapterId);
    UUID scene =
        id(
            "INSERT INTO scenes(storyboard_revision_id,chapter_id,project_id,order_index,title) VALUES (?,?,?,1,'Scene') RETURNING id",
            revision,
            chapterId,
            projectId);
    storyBeatId =
        id(
            "INSERT INTO story_beats(scene_id,order_index,summary,review_status) VALUES (?,1,'Beat','APPROVED') RETURNING id",
            scene);
    beatId =
        id(
            "INSERT INTO visual_beats(scene_id,story_beat_id,order_index,title,visual_intent,review_status) VALUES (?,?,1,'Visual','Hero walks','APPROVED') RETURNING id",
            scene,
            storyBeatId);
    UUID sequence =
        id("INSERT INTO shot_sequences(visual_beat_id) VALUES (?) RETURNING id", beatId);
    shotId =
        id(
            "INSERT INTO shots(sequence_id,order_index,narrative_purpose) VALUES (?,1,'Hero walks to the door') RETURNING id",
            sequence);
  }

  @AfterEach
  void resetLimits() {
    limits.setMaxConcurrentExpensiveJobs(2);
    video.setDefaultModel("ltx-2.5-nvfp4");
  }

  UUID id(String sql, Object... params) {
    return jdbc.queryForObject(sql, UUID.class, params);
  }

  GenerateShotTakeCommand command(String key, Long seed) {
    return new GenerateShotTakeCommand(projectId, shotId, null, seed, null, null, key, null);
  }

  TakeInputSnapshot snapshot(TakeResponse response) {
    return json.readValue(
        takes.findById(response.id()).orElseThrow().inputSnapshotJson(), TakeInputSnapshot.class);
  }

  int count(String table) {
    return jdbc.queryForObject(
        "SELECT COUNT(*) FROM "
            + table
            + " WHERE "
            + (table.equals("takes") ? "shot_id" : "project_id")
            + " = ?",
        Integer.class,
        table.equals("takes") ? shotId : projectId);
  }

  @Test
  void standaloneShotRoutesToVideoHandlerAndCallbackFinalizerWithoutWeakeningPlannedJobPointers() {
    var admitted = admission.execute(command("routing", 1L));
    var job = jobs.findByJobId(admitted.jobId()).orElseThrow();
    assertThat(job.getMediaPlanId()).isNull();
    assertThat(job.getProductionMode())
        .isEqualTo(
            com.narrativex.backend.feature.generation.domain.enums.ProductionMode.VIDEO_FIRST);
    assertThat(handlers.findHandler(job)).contains(videoHandler);
    assertThat(finalizers.findFinalizer(job.getType(), job.getProductionMode()))
        .contains(videoFinalizer);
    assertThatThrownBy(
            () ->
                job.toBuilder()
                    .productionMode(
                        com.narrativex.backend.feature.generation.domain.enums.ProductionMode
                            .IMAGE_MOTION)
                    .build())
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(
            () ->
                job.toBuilder()
                    .resourceClass(
                        com.narrativex.backend.feature.generation.domain.enums.ResourceClass
                            .PROVIDER_BATCH)
                    .build())
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void persistsCompleteIntentAndDeterministicReplay() {
    var first = admission.execute(command("transport", null));
    var frozen = snapshot(first);
    var replay = admission.execute(command("transport", null));
    assertThat(replay.id()).isEqualTo(first.id());
    assertThat(replay.jobId()).isEqualTo(first.jobId());
    assertThat(first.status()).isEqualTo("PENDING");
    assertThat(first.sourceDurationMs()).isNull();
    assertThat(snapshot(replay)).isEqualTo(frozen);
    assertThat(frozen.seed()).isPositive();
    var take = takes.findById(first.id()).orElseThrow();
    assertThat(take.computeTaskId()).isEqualTo(first.jobId());
    assertThat(take.computeAttemptId()).isNotNull();
    assertThat(jobs.findByComputeAttempt(take.computeTaskId(), take.computeAttemptId()))
        .isPresent();
    assertThat(take.operationPlanId()).isNotNull();
    assertThat(take.generationJobId()).isNotNull();
    assertThat(
            jdbc.queryForObject(
                "SELECT scope_id FROM operation_plans WHERE id=?",
                UUID.class,
                take.operationPlanId()))
        .isEqualTo(shotId);
    assertThat(count("takes")).isEqualTo(1);
    assertThat(count("generation_jobs")).isEqualTo(1);
    assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM stage_attempts WHERE generation_job_id=?",
                Integer.class,
                take.generationJobId()))
        .isEqualTo(1);
    assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM outbox_events WHERE event_key=?",
                Integer.class,
                "generation-job:" + first.jobId() + ":queued"))
        .isEqualTo(1);
  }

  @Test
  void sameKeyChangedSeedPromptOrSourceRevisionConflicts() {
    admission.execute(command("transport", 12L));
    assertThatThrownBy(() -> admission.execute(command("transport", 13L)))
        .isInstanceOf(ResourceConflictException.class);
    jdbc.update(
        "UPDATE shots SET narrative_purpose='different prompt',row_version=row_version+1 WHERE id=?",
        shotId);
    assertThatThrownBy(() -> admission.execute(command("transport", 12L)))
        .isInstanceOf(ResourceConflictException.class);
    jdbc.update(
        "UPDATE shots SET narrative_purpose='Hero walks to the door',row_version=0 WHERE id=?",
        shotId);
    jdbc.update("UPDATE chapters SET row_version=row_version+1 WHERE id=?", chapterId);
    assertThatThrownBy(() -> admission.execute(command("transport", 12L)))
        .isInstanceOf(ResourceConflictException.class);
    assertThat(count("takes")).isEqualTo(1);
  }

  @Test
  void concurrentReplayHasOneReservationAndDifferentKeysHaveDistinctAttemptNumbers()
      throws Exception {
    var replay =
        concurrently(
            () -> admission.execute(command("same", 21L)),
            () -> admission.execute(command("same", 21L)));
    assertThat(replay.get(0).id()).isEqualTo(replay.get(1).id());
    assertThat(count("takes")).isEqualTo(1);
    var fresh =
        concurrently(
            () -> admission.execute(command("fresh-1", 21L)),
            () -> admission.execute(command("fresh-2", 21L)));
    assertThat(fresh).extracting(TakeResponse::attemptNumber).containsExactlyInAnyOrder(2, 3);
    assertThat(count("takes")).isEqualTo(3);
    assertThat(count("generation_jobs")).isEqualTo(3);
  }

  @Test
  void immutableSnapshotGuardAndInsertFailureRollBackWholeIntent() {
    jdbc.execute(
        "CREATE FUNCTION reject_admission_take() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test take insert failure'; END $$");
    jdbc.execute(
        "CREATE TRIGGER test_reject_take BEFORE INSERT ON takes FOR EACH ROW EXECUTE FUNCTION reject_admission_take()");
    try {
      assertThatThrownBy(() -> admission.execute(command("fail-insert", null)))
          .isInstanceOf(org.springframework.dao.DataAccessException.class);
      assertThat(count("generation_jobs")).isZero();
      assertThat(count("operation_plans")).isZero();
      assertThat(count("takes")).isZero();
    } finally {
      jdbc.execute("DROP TRIGGER test_reject_take ON takes");
      jdbc.execute("DROP FUNCTION reject_admission_take()");
    }
    var admitted = admission.execute(command("good", null));
    assertThatThrownBy(
            () ->
                jdbc.update(
                    "UPDATE takes SET input_snapshot_json='{}'::jsonb WHERE id=?", admitted.id()))
        .isInstanceOf(org.springframework.dao.DataAccessException.class);
    assertThat(snapshot(admitted).shotId()).isEqualTo(shotId);
  }

  @Test
  void nativeSpeakerProfileWithoutAudioReferencePinsDescriptionVersionAndActualCueTypes() {
    UUID character = id("INSERT INTO characters(canonical_name) VALUES ('Hero') RETURNING id");
    UUID version =
        id(
            "INSERT INTO character_versions(character_id,version_number,bible,visual_prompt,status,locked_at) VALUES (?,1,'Adult hero','Stable hero','LOCKED',NOW()) RETURNING id",
            character);
    UUID participation =
        id(
            "INSERT INTO project_characters(project_id,character_id,role,importance,pinned_character_version_id) VALUES (?,?,'PROTAGONIST','PRIMARY',?) RETURNING id",
            projectId,
            character,
            version);
    jdbc.update(
        "INSERT INTO visual_beat_characters(visual_beat_id,project_character_id) VALUES (?,?)",
        beatId,
        participation);
    UUID voice =
        id(
            "INSERT INTO character_voice_profiles(character_id,version_number,voice_description,accent,delivery_baseline) VALUES (?,3,'Adult warm baritone','Northern Vietnamese','Calm measured') RETURNING id",
            character);
    jdbc.update("UPDATE characters SET pinned_voice_profile_id=? WHERE id=?", voice, character);
    for (int i = 0; i < 4; i++)
      jdbc.update(
          "INSERT INTO audio_cues(story_beat_id,order_index,cue_type,speaker_project_character_id,adapted_text,delivery_hint,status) VALUES (?,?,?,?,?,'Calm','APPROVED')",
          storyBeatId,
          i,
          List.of("NARRATOR", "DIALOGUE", "INNER_MONOLOGUE", "SYSTEM").get(i),
          participation,
          "Approved cue " + i);
    var take = admission.execute(command("native", null));
    var frozen = snapshot(take);
    assertThat(frozen.audioMode()).isEqualTo("LTX_NATIVE_AV");
    assertThat(frozen.inputs().get("prompt").toString())
        .contains(
            "Adult warm baritone", "Northern Vietnamese", "Approved cue 3", "INNER_MONOLOGUE");
    assertThat(json.writeValueAsString(frozen.context()))
        .contains(version.toString(), voice.toString(), "\"versionNumber\":3");
    jdbc.update(
        "UPDATE character_voice_profiles SET voice_description='Current live voice changed',row_version=row_version+1 WHERE id=?",
        voice);
    assertThat(snapshot(take)).isEqualTo(frozen);
  }

  @Test
  void invalidOrMissingConditioningReferencesRejectBeforeIntent() {
    var i2v =
        new GenerateShotTakeCommand(
            projectId, shotId, GenerationStrategy.IMAGE_TO_VIDEO, null, null, null, "i2v", null);
    assertThatThrownBy(() -> admission.execute(i2v)).hasMessageContaining("MISSING_REFERENCE");
    UUID other =
        id(
            "INSERT INTO projects(name,status,source_language,narration_language,metadata_language,image_aspect_ratio) VALUES ('other','DRAFT','en','en','en','RATIO_16_9') RETURNING id");
    UUID asset = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO media_assets(id,project_id,asset_type,origin,original_filename,content_type,size_bytes,sha256,status) VALUES (?,?,'IMAGE','USER_UPLOAD','frame','image/png',10,?,'READY')",
        asset,
        other,
        "b".repeat(64));
    jdbc.update(
        "INSERT INTO generation_references(shot_id,reference_type,media_asset_id) VALUES (?,'START_FRAME',?)",
        shotId,
        asset);
    assertThatThrownBy(() -> admission.execute(i2v))
        .hasMessageContaining("READY assets in this Project");
    jdbc.update(
        "UPDATE media_assets SET project_id=?,status='REJECTED' WHERE id=?", projectId, asset);
    assertThatThrownBy(() -> admission.execute(i2v))
        .hasMessageContaining("READY assets in this Project");
    jdbc.update("UPDATE media_assets SET status='READY' WHERE id=?", asset);
    var generated = admission.execute(i2v);
    assertThat(snapshot(generated).references()).hasSize(1);
    assertThat(snapshot(generated).references().get(0).sha256()).isEqualTo("b".repeat(64));
  }

  @Test
  void capacityAdmissionAndExecutionClaimsAreSerialized() throws Exception {
    limits.setMaxConcurrentExpensiveJobs(2);
    var queued =
        concurrently(
            () -> admission.execute(command("queue-1", null)),
            () -> admission.execute(command("queue-2", null)));
    assertThatThrownBy(() -> admission.execute(command("queue-3", null)))
        .isInstanceOf(GenerationAdmissionDeniedException.class);
    var claims =
        concurrently(() -> claim(queued.get(0).jobId()), () -> claim(queued.get(1).jobId()));
    assertThat(claims).containsExactlyInAnyOrder(true, false);
    assertThat(jobs.countActiveVideoExecutions()).isEqualTo(1);
    assertThat(count("takes")).isEqualTo(2);
    UUID claimed =
        jdbc.queryForObject(
            "SELECT job_id FROM generation_jobs WHERE project_id=? AND status='SUBMITTING'",
            UUID.class,
            projectId);
    jobs.save(jobs.findByJobId(claimed).orElseThrow().markFailed("test", "test"));
    UUID waiting =
        queued.stream()
            .map(TakeResponse::jobId)
            .filter(j -> !j.equals(claimed))
            .findFirst()
            .orElseThrow();
    assertThat(claim(waiting)).isTrue();
    assertThat(jobs.countActiveVideoExecutions()).isEqualTo(1);
  }

  boolean claim(UUID job) {
    try {
      return transactions.claimForSubmission(job, "GENERATING_VIDEO").isPresent();
    } catch (GenerationAdmissionDeniedException e) {
      return false;
    }
  }

  @Test
  void frozenDispatchIgnoresCurrentShotAndConfigurationAndIoRunsAfterCommit() {
    var admitted = admission.execute(command("frozen", 88L));
    var frozen = snapshot(admitted);
    jdbc.update(
        "UPDATE shots SET narrative_purpose='Wrong live prompt',target_duration_ms=8000,row_version=row_version+1 WHERE id=?",
        shotId);
    video.setDefaultModel("wrong-live-model");
    GenerationExecutionPort execution = mock(GenerationExecutionPort.class);
    ComputeArtifactAccess artifacts = mock(ComputeArtifactAccess.class);
    when(artifacts.getOrCreateTarget(any(), any(), any(), eq("video"), eq("video/mp4")))
        .thenAnswer(i -> new OutputArtifactTargetDto(i.getArgument(2), "video", "video/mp4", null));
    when(execution.submitTask(any()))
        .thenAnswer(
            i -> {
              assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
              assertThat(count("takes")).isEqualTo(1);
              assertThat(count("generation_jobs")).isEqualTo(1);
              assertThat(count("operation_plans")).isEqualTo(1);
              ComputeTaskRequest request = i.getArgument(0);
              assertThat(request.inputs().get("prompt")).isEqualTo(frozen.inputs().get("prompt"));
              assertThat(request.inputs().get("durationMs"))
                  .isEqualTo(frozen.inputs().get("durationMs"));
              assertThat(request.model().model()).isEqualTo(frozen.model());
              assertThat(request.constraints().deadline()).isEqualTo(frozen.deadline());
              return new ComputeSubmissionReceipt(
                  request.taskId(), request.attemptId(), "test-handle", "ACCEPTED", 1L);
            });
    var handler =
        new VideoGenerationJobHandler(
            transactions,
            execution,
            artifacts,
            null,
            null,
            null,
            takeMapper,
            new com.narrativex.backend.feature.generation.infrastructure.compute
                .VideoGenerationProperties());
    handler.execute(admitted.jobId());
    verify(execution, times(1)).submitTask(any());
    assertThat(takes.findById(admitted.id()).orElseThrow().status()).isEqualTo("RUNNING");
  }

  @Test
  void missingFrozenTakeCannotSubmitAndIsTerminalFailure() {
    var admitted = admission.execute(command("missing", null));
    jdbc.update("DELETE FROM takes WHERE id=?", admitted.id());
    GenerationExecutionPort execution = mock(GenerationExecutionPort.class);
    new VideoGenerationJobHandler(
            transactions,
            execution,
            mock(ComputeArtifactAccess.class),
            null,
            null,
            null,
            takeMapper,
            new com.narrativex.backend.feature.generation.infrastructure.compute
                .VideoGenerationProperties())
        .execute(admitted.jobId());
    verifyNoInteractions(execution);
    assertThat(jobs.findByJobId(admitted.jobId()).orElseThrow().getStatus())
        .isEqualTo(com.narrativex.backend.feature.generation.domain.enums.JobStatus.FAILED);
  }

  @Test
  void ambiguousExternalSubmitKeepsFrozenTakeAndUnknownSlot() {
    var admitted = admission.execute(command("ambiguous", null));
    var frozen = snapshot(admitted);
    GenerationExecutionPort execution = mock(GenerationExecutionPort.class);
    ComputeArtifactAccess artifacts = mock(ComputeArtifactAccess.class);
    when(artifacts.getOrCreateTarget(any(), any(), any(), any(), any()))
        .thenAnswer(i -> new OutputArtifactTargetDto(i.getArgument(2), "video", "video/mp4", null));
    when(execution.submitTask(any())).thenThrow(new IllegalStateException("connection lost"));
    var handler =
        new VideoGenerationJobHandler(
            transactions,
            execution,
            artifacts,
            null,
            null,
            null,
            takeMapper,
            new com.narrativex.backend.feature.generation.infrastructure.compute
                .VideoGenerationProperties());
    handler.execute(admitted.jobId());
    handler.execute(admitted.jobId());
    verify(execution, times(1)).submitTask(any());
    assertThat(jobs.findByJobId(admitted.jobId()).orElseThrow().getStatus())
        .isEqualTo(com.narrativex.backend.feature.generation.domain.enums.JobStatus.UNKNOWN);
    assertThat(snapshot(admitted)).isEqualTo(frozen);
    assertThat(jobs.countActiveVideoExecutions()).isEqualTo(1);
  }

  @Test
  void mismatchedReceiptCannotReplaceAdmittedAttemptIdentity() {
    var admitted = admission.execute(command("receipt-mismatch", 1L));
    var original = jobs.findByJobId(admitted.jobId()).orElseThrow().getComputeAttemptId();
    GenerationExecutionPort execution = mock(GenerationExecutionPort.class);
    ComputeArtifactAccess artifacts = mock(ComputeArtifactAccess.class);
    when(artifacts.getOrCreateTarget(any(), any(), any(), any(), any()))
        .thenAnswer(i -> new OutputArtifactTargetDto(i.getArgument(2), "video", "video/mp4", null));
    when(execution.submitTask(any()))
        .thenReturn(
            new ComputeSubmissionReceipt(
                admitted.jobId(), UUID.randomUUID(), "test-handle", "ACCEPTED", 1L));
    new VideoGenerationJobHandler(
            transactions,
            execution,
            artifacts,
            null,
            null,
            null,
            takeMapper,
            new com.narrativex.backend.feature.generation.infrastructure.compute
                .VideoGenerationProperties())
        .execute(admitted.jobId());
    var job = jobs.findByJobId(admitted.jobId()).orElseThrow();
    assertThat(job.getComputeAttemptId()).isEqualTo(original);
    assertThat(job.getStatus())
        .isEqualTo(com.narrativex.backend.feature.generation.domain.enums.JobStatus.UNKNOWN);
  }

  @Test
  void earlyCallbackTakeStateCannotBeRegressedByLateSubmitAcknowledgement() {
    for (String terminal : List.of("PASSED", "FAILED")) {
      var admitted = admission.execute(command("callback-" + terminal, 1L));
      GenerationExecutionPort execution = mock(GenerationExecutionPort.class);
      ComputeArtifactAccess artifacts = mock(ComputeArtifactAccess.class);
      when(artifacts.getOrCreateTarget(any(), any(), any(), any(), any()))
          .thenAnswer(
              i -> new OutputArtifactTargetDto(i.getArgument(2), "video", "video/mp4", null));
      when(execution.submitTask(any()))
          .thenAnswer(
              i -> {
                takeMapper.updateStatus(admitted.id(), terminal);
                jobs.save(
                    jobs.findByJobId(admitted.jobId())
                        .orElseThrow()
                        .markCompleted("early callback"));
                ComputeTaskRequest request = i.getArgument(0);
                return new ComputeSubmissionReceipt(
                    request.taskId(), request.attemptId(), "test-handle", "ACCEPTED", 1L);
              });
      new VideoGenerationJobHandler(
              transactions,
              execution,
              artifacts,
              null,
              null,
              null,
              takeMapper,
              new com.narrativex.backend.feature.generation.infrastructure.compute
                  .VideoGenerationProperties())
          .execute(admitted.jobId());
      assertThat(takes.findById(admitted.id()).orElseThrow().status()).isEqualTo(terminal);
      assertThat(jobs.findByJobId(admitted.jobId()).orElseThrow().getStatus())
          .isEqualTo(com.narrativex.backend.feature.generation.domain.enums.JobStatus.COMPLETED);
    }
  }

  @Test
  void sameCommandReplaysAfterShotLifecycleUpdateButRealInputChangesStillConflict() {
    var admitted = admission.execute(command("lifecycle", 21L));
    var frozen = snapshot(admitted);
    shots.updateStatus(shotId, "SELECTED");
    assertThat(admission.execute(command("lifecycle", 21L)).id()).isEqualTo(admitted.id());
    assertThat(snapshot(admitted)).isEqualTo(frozen);
    jdbc.update(
        "UPDATE shots SET action_json='{\"action\":\"Hero jumps\"}'::jsonb,row_version=row_version+1 WHERE id=?",
        shotId);
    assertThatThrownBy(() -> admission.execute(command("lifecycle", 21L)))
        .isInstanceOf(ResourceConflictException.class);
  }

  @Test
  void unknownCannotAuthorizeNewRetry() {
    var admitted = admission.execute(command("original", 1L));
    assertThat(claim(admitted.jobId())).isTrue();
    transactions.markSubmissionUnknown(
        admitted.jobId(), "UNKNOWN", "test", java.time.Instant.now());
    var retry =
        new GenerateShotTakeCommand(
            projectId, shotId, null, 1L, admitted.id(), "retake", "retry", null);
    assertThatThrownBy(() -> admission.execute(retry))
        .isInstanceOf(ResourceConflictException.class);
    assertThatThrownBy(() -> admission.execute(command("blind-new-key", 1L)))
        .isInstanceOf(ResourceConflictException.class);
    assertThat(admission.execute(command("original", 1L)).id()).isEqualTo(admitted.id());
    assertThat(count("takes")).isEqualTo(1);
  }

  <T> List<T> concurrently(Callable<T> first, Callable<T> second) throws Exception {
    var start = new CountDownLatch(1);
    try (var executor = Executors.newFixedThreadPool(2)) {
      var a =
          executor.submit(
              () -> {
                start.await();
                return first.call();
              });
      var b =
          executor.submit(
              () -> {
                start.await();
                return second.call();
              });
      start.countDown();
      return List.of(a.get(15, TimeUnit.SECONDS), b.get(15, TimeUnit.SECONDS));
    }
  }
}
