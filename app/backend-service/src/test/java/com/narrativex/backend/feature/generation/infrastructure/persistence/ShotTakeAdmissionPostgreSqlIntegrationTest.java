package com.narrativex.backend.feature.generation.infrastructure.persistence;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.narrativex.backend.configuration.NarrativeXLimitsProperties;
import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.generation.api.response.TakeResponse;
import com.narrativex.backend.feature.generation.application.command.GenerateShotTakeCommand;
import com.narrativex.backend.feature.generation.application.model.TakeInputSnapshot;
import com.narrativex.backend.feature.generation.application.model.compute.*;
import com.narrativex.backend.feature.generation.application.port.out.*;
import com.narrativex.backend.feature.generation.application.service.GenerationJobTransactionService;
import com.narrativex.backend.feature.generation.application.usecase.GenerateShotTakeUseCase;
import com.narrativex.backend.feature.generation.application.usecase.GetChapterProductionUseCase;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import com.narrativex.backend.feature.generation.domain.value.SelectedTake;
import com.narrativex.backend.feature.generation.domain.value.TakeContentReviewChecklist;
import com.narrativex.backend.feature.generation.infrastructure.compute.VideoGenerationProperties;
import com.narrativex.backend.feature.generation.infrastructure.dispatch.ChapterAnalysisArtifactMaterializer;
import com.narrativex.backend.feature.generation.infrastructure.dispatch.VideoGenerationJobHandler;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.TakeMapper;
import com.narrativex.backend.feature.storyboard.application.port.out.ShotAudioCueAllocationRepository;
import com.narrativex.backend.feature.storyboard.application.service.SourceAnchorResolver;
import com.narrativex.backend.feature.storyboard.application.usecase.ReplaceShotAudioCueAllocationsUseCase;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter.ChapterCanonReconciliationService;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterCanonMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ShotSequenceMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.StoryboardMapper;
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
  @Autowired GetChapterProductionUseCase chapterProduction;
  @Autowired SelectedTakeRepository selectedTakes;
  @Autowired VisualPromptContextRepository visualPromptContexts;
  @Autowired ReplaceShotAudioCueAllocationsUseCase replaceShotAudioCueAllocations;
  @Autowired ShotAudioCueAllocationRepository shotAudioCueAllocations;
  @Autowired org.springframework.transaction.PlatformTransactionManager transactionManager;
  @Autowired TakeMapper takeMapper;
  @Autowired GenerationJobTransactionService transactions;
  @Autowired NarrativeXLimitsProperties limits;
  @Autowired VideoGenerationProperties video;
  @Autowired JdbcTemplate jdbc;

  @Autowired StoryboardMapper materializationStoryboardMapper;
  @Autowired ChapterMapper materializationChapterMapper;
  @Autowired ChapterCanonMapper chapterCanonMapper;
  @Autowired ChapterCanonReconciliationService chapterCanonReconciliationService;
  @Autowired ShotSequenceMapper shotSequenceMapper;

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

  UUID projectId, chapterId, beatId, storyBeatId, sequenceId, shotId;
  JsonMapper json = JsonMapper.builder().build();

  @BeforeEach
  void seed() {
    jdbc.update(
        "UPDATE generation_jobs SET status = 'COMPLETED' WHERE idempotency_key LIKE 'shot-take:%'");
    limits.setMaxConcurrentExpensiveJobs(100);
    video.setDefaultProvider("ltx");
    video.setDefaultModel("ltx-2.5-22b-distilled-int8");
    video.setSupportedStrategies(List.of(GenerationStrategy.TEXT_TO_VIDEO));
    projectId =
        id(
            "INSERT INTO projects(name,status,source_language,narration_language,image_aspect_ratio) VALUES ('admission','DRAFT','en', 'en','RATIO_16_9') RETURNING id");
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
    sequenceId = id("INSERT INTO shot_sequences(visual_beat_id) VALUES (?) RETURNING id", beatId);
    shotId =
        id(
            "INSERT INTO shots(sequence_id,order_index,narrative_purpose) VALUES (?,1,'Hero walks to the door') RETURNING id",
            sequenceId);
  }

  @AfterEach
  void resetLimits() {
    limits.setMaxConcurrentExpensiveJobs(2);
    video.setDefaultModel("ltx-2.5-22b-distilled-int8");
  }

  UUID id(String sql, Object... params) {
    return jdbc.queryForObject(sql, UUID.class, params);
  }

  private static void await(CountDownLatch latch) {
    try {
      latch.await();
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Concurrent writer test was interrupted", exception);
    }
  }

  UUID addProjectCharacter(
      UUID ownerProjectId,
      String canonicalName,
      String aiName,
      boolean identityActive,
      boolean participatesInBeat,
      String beatRole) {
    UUID characterId =
        id("INSERT INTO characters(canonical_name) VALUES (?) RETURNING id", canonicalName);
    UUID versionId =
        id(
            "INSERT INTO character_versions(character_id,version_number,bible,visual_prompt,status,locked_at) VALUES (?,1,'Fixture','Fixture prompt','LOCKED',CURRENT_TIMESTAMP) RETURNING id",
            characterId);
    UUID projectCharacterId =
        id(
            "INSERT INTO project_characters(project_id,character_id,role,importance,pinned_character_version_id) VALUES (?,?,'SUPPORTING','SECONDARY',?) RETURNING id",
            ownerProjectId,
            characterId,
            versionId);
    if (aiName != null) {
      jdbc.update(
          "INSERT INTO project_character_ai_identities(project_id,project_character_id,ai_name,is_active) VALUES (?,?,?,?)",
          ownerProjectId,
          projectCharacterId,
          aiName,
          identityActive);
    }
    if (participatesInBeat) {
      jdbc.update(
          "INSERT INTO visual_beat_characters(visual_beat_id,project_character_id,role) VALUES (?,?,?)",
          beatId,
          projectCharacterId,
          beatRole);
    }
    return projectCharacterId;
  }

  GenerateShotTakeCommand command(String key, Long seed) {
    return new GenerateShotTakeCommand(projectId, shotId, null, seed, null, null, key, null);
  }

  TakeInputSnapshot snapshot(TakeResponse response) {
    return json.readValue(
        takes.findById(response.id()).orElseThrow().inputSnapshotJson(), TakeInputSnapshot.class);
  }

  int count(String table) {
    if (table.equals("outbox_events")) {
      return jdbc.queryForObject(
          "SELECT COUNT(*) FROM outbox_events o JOIN generation_jobs j ON o.aggregate_id = j.job_id::text WHERE o.aggregate_type = 'GENERATION_JOB' AND j.project_id = ?",
          Integer.class,
          projectId);
    }
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
  void selectedTakeReviewUsesOptimisticVersionAndPersistsTrimFingerprint() {
    var admitted = admission.execute(command("review-selection", null));
    var take = takes.findById(admitted.id()).orElseThrow();
    var checklist = new TakeContentReviewChecklist(true, true, true, true, true);
    String reviewFingerprint = "a".repeat(64);

    var first =
        selectedTakes.saveSelection(
            shotId, admitted.id(), 250L, 3_250L, 0L, reviewFingerprint, checklist.toJson());
    assertThat(first.rowVersion()).isEqualTo(1L);
    assertThat(first.reviewFingerprint()).isEqualTo(reviewFingerprint);
    assertThat(json.readTree(first.reviewChecklistJson()).path("lipSync").asBoolean()).isTrue();

    var second =
        selectedTakes.saveSelection(
            shotId,
            admitted.id(),
            500L,
            3_000L,
            first.rowVersion(),
            "b".repeat(64),
            checklist.toJson());
    assertThat(second.rowVersion()).isEqualTo(2L);
    assertThat(second.sourceInMs()).isEqualTo(500L);

    assertThatThrownBy(
            () ->
                selectedTakes.saveSelection(
                    shotId,
                    admitted.id(),
                    0L,
                    3_000L,
                    first.rowVersion(),
                    "c".repeat(64),
                    checklist.toJson()))
        .isInstanceOf(ResourceConflictException.class)
        .hasMessageContaining("changed in another window");
    assertThat(take.inputFingerprint()).isNotBlank();
  }

  @Test
  void selectedTakeUpdatesLegacyVersionZeroAndNeverInsertsForMissingNewerVersion() {
    var admitted = admission.execute(command("legacy-selection", null));
    jdbc.update(
        "INSERT INTO selected_takes(shot_id,take_id,source_in_ms,source_out_ms,row_version) VALUES (?,?,0,3000,0)",
        shotId,
        admitted.id());

    var saved =
        selectedTakes.saveSelection(
            shotId,
            admitted.id(),
            250L,
            2_750L,
            0L,
            "a".repeat(64),
            new TakeContentReviewChecklist(true, true, true, true, true).toJson());

    assertThat(saved.rowVersion()).isEqualTo(1L);
    assertThat(saved.sourceInMs()).isEqualTo(250L);
    assertThatThrownBy(
            () ->
                selectedTakes.saveSelection(
                    UUID.randomUUID(),
                    admitted.id(),
                    0L,
                    3_000L,
                    1L,
                    "b".repeat(64),
                    new TakeContentReviewChecklist(true, true, true, true, true).toJson()))
        .isInstanceOf(ResourceConflictException.class);
  }

  @Test
  void concurrentSelectedTakeCompareAndSetAllowsOnlyOneWriter() throws Exception {
    var admitted = admission.execute(command("concurrent-selection", null));
    var first =
        selectedTakes.saveSelection(
            shotId,
            admitted.id(),
            250L,
            3_250L,
            0L,
            "a".repeat(64),
            new TakeContentReviewChecklist(true, true, true, true, true).toJson());
    var start = new CountDownLatch(1);
    var pool = Executors.newFixedThreadPool(2);
    try {
      var writers =
          List.of(
              pool.submit(
                  () -> {
                    await(start);
                    try {
                      return selectedTakes.saveSelection(
                          shotId,
                          admitted.id(),
                          500L,
                          3_000L,
                          first.rowVersion(),
                          "b".repeat(64),
                          new TakeContentReviewChecklist(true, true, true, true, true).toJson());
                    } catch (ResourceConflictException conflict) {
                      return conflict;
                    }
                  }),
              pool.submit(
                  () -> {
                    await(start);
                    try {
                      return selectedTakes.saveSelection(
                          shotId,
                          admitted.id(),
                          750L,
                          2_750L,
                          first.rowVersion(),
                          "c".repeat(64),
                          new TakeContentReviewChecklist(true, true, true, true, true).toJson());
                    } catch (ResourceConflictException conflict) {
                      return conflict;
                    }
                  }));
      start.countDown();
      List<Object> results = new ArrayList<>();
      for (var writer : writers) results.add(writer.get(10, TimeUnit.SECONDS));

      assertThat(results).filteredOn(SelectedTake.class::isInstance).hasSize(1);
      assertThat(results).filteredOn(ResourceConflictException.class::isInstance).hasSize(1);
      assertThat(selectedTakes.findByShotId(shotId).orElseThrow().rowVersion()).isEqualTo(2L);
    } finally {
      pool.shutdownNow();
    }
  }

  @Test
  void shotCharacterContextUsesOnlyActiveProjectIdentityForBeatParticipants() {
    assertThat(visualPromptContexts.findForShot(projectId, shotId).characters()).isEmpty();

    UUID active = addProjectCharacter(projectId, "Visible Hero", "Hero AI", true, true, "PRIMARY");
    UUID inactive =
        addProjectCharacter(projectId, "Inactive Alias", "Old AI", false, true, "SECONDARY");
    UUID missing = addProjectCharacter(projectId, "No Alias", null, false, true, "SECONDARY");
    addProjectCharacter(projectId, "Not In Beat", "Unrelated AI", true, false, "SECONDARY");
    UUID otherProject =
        id(
            "INSERT INTO projects(name,status,source_language,narration_language,image_aspect_ratio) VALUES ('other-project','DRAFT','vi','vi','RATIO_16_9') RETURNING id");
    addProjectCharacter(otherProject, "Foreign Hero", "Foreign AI", true, true, "PRIMARY");

    var characters = visualPromptContexts.findForShot(projectId, shotId).characters();

    assertThat(characters).hasSize(3);
    assertThat(characters)
        .extracting(character -> character.assignmentId())
        .containsExactlyInAnyOrder(active, inactive, missing);
    assertThat(characters)
        .filteredOn(character -> character.assignmentId().equals(active))
        .singleElement()
        .satisfies(
            character -> {
              assertThat(character.canonicalName()).isEqualTo("Visible Hero");
              assertThat(character.aiName()).isEqualTo("Hero AI");
              assertThat(character.characterVersionId()).isNotNull();
            });
    assertThat(characters)
        .filteredOn(character -> character.assignmentId().equals(inactive))
        .singleElement()
        .extracting(character -> character.aiName())
        .isNull();
    assertThat(characters)
        .filteredOn(character -> character.assignmentId().equals(missing))
        .singleElement()
        .extracting(character -> character.aiName())
        .isNull();
    assertThat(visualPromptContexts.findForShot(projectId, shotId).characters())
        .extracting(character -> character.assignmentId())
        .containsExactlyElementsOf(
            characters.stream().map(character -> character.assignmentId()).toList());
  }

  @Test
  void chapterProductionReadModelPreservesCueTextAndStatusForSameSpeaker() {
    UUID speaker = addProjectCharacter(projectId, "Cue Speaker", null, false, false, "SECONDARY");
    UUID firstCue =
        id(
            "INSERT INTO audio_cues(story_beat_id,order_index,cue_type,speaker_project_character_id,adaptation_action,adapted_text,status) VALUES (?,1,'DIALOGUE',?,'LIGHT_EDIT','First distinct line','DRAFT') RETURNING id",
            storyBeatId,
            speaker);
    UUID secondCue =
        id(
            "INSERT INTO audio_cues(story_beat_id,order_index,cue_type,speaker_project_character_id,adaptation_action,adapted_text,status) VALUES (?,2,'DIALOGUE',?,'LIGHT_EDIT','Second distinct line','APPROVED') RETURNING id",
            storyBeatId,
            speaker);

    var response = chapterProduction.execute(projectId, chapterId);
    var cues =
        response.scenes().stream()
            .flatMap(scene -> scene.visualBeats().stream())
            .flatMap(beat -> beat.audioCues().stream())
            .toList();

    assertThat(cues).extracting(cue -> cue.id()).containsExactly(firstCue, secondCue);
    assertThat(cues)
        .extracting(cue -> cue.adaptedText())
        .containsExactly("First distinct line", "Second distinct line");
    assertThat(cues).extracting(cue -> cue.status()).containsExactly("DRAFT", "APPROVED");
  }

  @Test
  void materializedVietnameseDefaultShotDurationPassesTheSamePostgresAdmissionEstimate()
      throws Exception {
    String source = "ắ".repeat(67);
    String sourceHash =
        HexFormat.of()
            .formatHex(
                java.security.MessageDigest.getInstance("SHA-256")
                    .digest(source.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    UUID materializedProject =
        id(
            "INSERT INTO projects(name,status,source_language,narration_language,image_aspect_ratio) VALUES ('duration-estimate','DRAFT','vi','vi','RATIO_16_9') RETURNING id");
    UUID storyVersionId =
        id(
            "INSERT INTO story_versions(project_id,version_number,content,source_language,status) VALUES (?,1,?,'vi','ACTIVE') RETURNING id",
            materializedProject,
            source);
    UUID materializedChapterId =
        id(
            "INSERT INTO chapters(story_version_id,order_index,title,source_text,source_hash) VALUES (?,1,'Duration fixture',?,?) RETURNING id",
            storyVersionId,
            source,
            sourceHash);
    UUID revisionId =
        id(
            "INSERT INTO storyboard_revisions(chapter_id,revision_number,source_hash,source_row_version) VALUES (?,1,?,0) RETURNING id",
            materializedChapterId,
            sourceHash);
    jdbc.update(
        "UPDATE chapters SET current_storyboard_revision_id=? WHERE id=?",
        revisionId,
        materializedChapterId);
    var analysisJob =
        GenerationJob.createChapterAnalysis(
            materializedProject,
            storyVersionId,
            materializedChapterId,
            revisionId,
            0L,
            sourceHash,
            source,
            "vi",
            "duration-estimate-" + UUID.randomUUID());
    String payload =
        """
        {
          "canon":{"characters":[{"ai_name":"hero","canonical_name":"Hero","aliases":[],"role":"PROTAGONIST","importance":"PRIMARY","description":"A hero","visual_prompt":"A hero"}],"locations":[]},
          "scenes":[{"title":"Scene","character_ai_names":["hero"],"visual_beats":[{
            "title":"Hero speaks","visual_intent":"The hero speaks","start_unit":0,
            "character_ai_names":[{"ai_name":"hero","role":"PRIMARY"}],
            "visual_direction":{"shot_size":"MEDIUM","camera_angle":"EYE_LEVEL","lens_mm":35,"focus_target":"hero","action_phase":"DURING","subject_placement":"center","foreground":"clear","background":"simple","motivated_light":"soft daylight","palette":"warm","camera_movement":"STATIC","movement_direction":"NONE","movement_intensity":"SUBTLE","crop_safe_area":"full"},
            "audio_cues":[{"cue_type":"DIALOGUE","speaker_ai_name":"hero","start_unit":0,"end_unit":0,"adaptation_action":"KEEP_EXACT"}]
          }]}]
        }
        """;

    var materializer =
        new ChapterAnalysisArtifactMaterializer(
            materializationStoryboardMapper,
            materializationChapterMapper,
            new SourceAnchorResolver(),
            chapterCanonMapper,
            chapterCanonReconciliationService,
            null,
            null,
            null,
            shotSequenceMapper,
            shots);
    materializer.materialize(
        analysisJob, payload.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    UUID defaultShotId =
        jdbc.queryForObject(
            "SELECT sh.id FROM shots sh JOIN shot_sequences ss ON ss.id=sh.sequence_id JOIN visual_beats vb ON vb.id=ss.visual_beat_id JOIN scenes s ON s.id=vb.scene_id WHERE s.chapter_id=?",
            UUID.class,
            materializedChapterId);
    long persistedDuration =
        jdbc.queryForObject(
            "SELECT target_duration_ms FROM shots WHERE id=?", Long.class, defaultShotId);
    UUID characterId =
        id("SELECT character_id FROM project_characters WHERE project_id=?", materializedProject);
    UUID voiceProfileId =
        id(
            "INSERT INTO character_voice_profiles(character_id,version_number,voice_description,accent,delivery_baseline) VALUES (?,1,'Warm clear voice','Northern Vietnamese','Measured') RETURNING id",
            characterId);
    UUID characterVersionId =
        id(
            "SELECT id FROM character_versions WHERE character_id=? ORDER BY version_number DESC LIMIT 1",
            characterId);
    jdbc.update(
        "UPDATE character_versions SET status='LOCKED', locked_at=CURRENT_TIMESTAMP WHERE id=?",
        characterVersionId);
    jdbc.update(
        "UPDATE project_characters SET pinned_character_version_id=? WHERE project_id=? AND character_id=?",
        characterVersionId,
        materializedProject,
        characterId);
    jdbc.update(
        "UPDATE characters SET pinned_voice_profile_id=? WHERE id=?", voiceProfileId, characterId);
    jdbc.update(
        "UPDATE story_beats SET review_status='APPROVED' WHERE scene_id IN (SELECT id FROM scenes WHERE chapter_id=?)",
        materializedChapterId);
    jdbc.update(
        "UPDATE visual_beats SET review_status='APPROVED' WHERE scene_id IN (SELECT id FROM scenes WHERE chapter_id=?)",
        materializedChapterId);
    jdbc.update(
        "UPDATE audio_cues SET status='APPROVED' WHERE story_beat_id IN (SELECT sb.id FROM story_beats sb JOIN scenes s ON s.id=sb.scene_id WHERE s.chapter_id=?)",
        materializedChapterId);

    assertThat(persistedDuration).isEqualTo(5_625L);
    var admitted =
        admission.execute(
            new GenerateShotTakeCommand(
                materializedProject,
                defaultShotId,
                null,
                null,
                null,
                null,
                "duration-admission-" + UUID.randomUUID(),
                null));
    assertThat(admitted.id()).isNotNull();
    assertThat(takes.findById(admitted.id()).orElseThrow().inputSnapshotJson()).contains(source);
  }

  @Test
  void cueAllocationIsCompletePerShotAndStaleCueVersionsBlockAdmissionContext() throws Exception {
    UUID secondShotId =
        id(
            "INSERT INTO shots(sequence_id,order_index,narrative_purpose) VALUES (?,2,'Reaction') RETURNING id",
            sequenceId);
    UUID firstCueId =
        id(
            "INSERT INTO audio_cues(story_beat_id,order_index,cue_type,adaptation_action,adapted_text,status) VALUES (?,1,'DIALOGUE','KEEP_EXACT','Hero enters', 'APPROVED') RETURNING id",
            storyBeatId);
    UUID secondCueId =
        id(
            "INSERT INTO audio_cues(story_beat_id,order_index,cue_type,adaptation_action,adapted_text,status) VALUES (?,2,'DIALOGUE','KEEP_EXACT','Who is there?', 'APPROVED') RETURNING id",
            storyBeatId);
    var assignments =
        List.of(
            new ReplaceShotAudioCueAllocationsUseCase.Assignment(firstCueId, shotId),
            new ReplaceShotAudioCueAllocationsUseCase.Assignment(secondCueId, secondShotId));

    var saved = replaceShotAudioCueAllocations.execute(projectId, sequenceId, 0L, assignments);
    assertThat(saved.rowVersion()).isEqualTo(1L);
    assertThat(saved.allocations()).hasSize(2);

    var reassigned =
        replaceShotAudioCueAllocations.execute(
            projectId,
            sequenceId,
            saved.rowVersion(),
            List.of(
                new ReplaceShotAudioCueAllocationsUseCase.Assignment(firstCueId, secondShotId),
                new ReplaceShotAudioCueAllocationsUseCase.Assignment(secondCueId, shotId)));
    assertThat(reassigned.rowVersion()).isEqualTo(2L);
    assertThat(reassigned.allocations())
        .extracting(allocation -> allocation.shotId())
        .containsExactlyInAnyOrder(secondShotId, shotId);

    var context = json.readValue(shots.findAdmissionContextLocked(projectId, shotId), Map.class);
    assertThat(context.get("cueAllocationComplete")).isEqualTo(true);
    assertThat(context.get("shotSequenceShotCount")).isEqualTo(2);
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> selectedCues = (List<Map<String, Object>>) context.get("cues");
    assertThat(selectedCues)
        .extracting(cue -> cue.get("id").toString())
        .containsExactly(secondCueId.toString());

    jdbc.update(
        "UPDATE audio_cues SET adapted_text = 'The changed line', row_version = row_version + 1 WHERE id = ?",
        firstCueId);
    var staleContext =
        json.readValue(shots.findAdmissionContextLocked(projectId, shotId), Map.class);
    assertThat(staleContext.get("cueAllocationComplete")).isEqualTo(false);
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> staleCues = (List<Map<String, Object>>) staleContext.get("cues");
    assertThat(staleCues)
        .extracting(cue -> cue.get("id").toString())
        .containsExactly(secondCueId.toString());

    var refreshed =
        replaceShotAudioCueAllocations.execute(
            projectId,
            sequenceId,
            reassigned.rowVersion(),
            List.of(
                new ReplaceShotAudioCueAllocationsUseCase.Assignment(firstCueId, shotId),
                new ReplaceShotAudioCueAllocationsUseCase.Assignment(secondCueId, secondShotId)));
    assertThat(refreshed.rowVersion()).isEqualTo(3L);
    assertThat(refreshed.allocations())
        .filteredOn(allocation -> allocation.audioCueId().equals(firstCueId))
        .singleElement()
        .extracting(allocation -> allocation.audioCueRowVersion())
        .isEqualTo(1L);
    var refreshedContext =
        json.readValue(shots.findAdmissionContextLocked(projectId, shotId), Map.class);
    assertThat(refreshedContext.get("cueAllocationComplete")).isEqualTo(true);
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> refreshedCues =
        (List<Map<String, Object>>) refreshedContext.get("cues");
    assertThat(refreshedCues)
        .extracting(cue -> cue.get("adapted_text"))
        .containsExactly("The changed line");

    assertThatThrownBy(
            () ->
                replaceShotAudioCueAllocations.execute(
                    projectId, sequenceId, reassigned.rowVersion(), assignments))
        .isInstanceOf(ResourceConflictException.class);
    assertThat(shotAudioCueAllocations.findBySequenceId(sequenceId).orElseThrow())
        .isEqualTo(refreshed);
  }

  @Test
  void allocationInsertFailureRollsBackVersionAndExistingMappings() {
    UUID cueId =
        id(
            "INSERT INTO audio_cues(story_beat_id,order_index,cue_type,adaptation_action,adapted_text,status) VALUES (?,1,'DIALOGUE','KEEP_EXACT','Hello', 'APPROVED') RETURNING id",
            storyBeatId);
    var saved =
        replaceShotAudioCueAllocations.execute(
            projectId,
            sequenceId,
            0L,
            List.of(new ReplaceShotAudioCueAllocationsUseCase.Assignment(cueId, shotId)));
    var invalid =
        new com.narrativex.backend.feature.storyboard.application.model.ShotAudioCueAllocation(
            UUID.randomUUID(), shotId, 0L);

    assertThatThrownBy(
            () ->
                new org.springframework.transaction.support.TransactionTemplate(transactionManager)
                    .executeWithoutResult(
                        status ->
                            shotAudioCueAllocations.replace(
                                sequenceId, saved.rowVersion(), List.of(invalid))))
        .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);

    assertThat(shotAudioCueAllocations.findBySequenceId(sequenceId).orElseThrow()).isEqualTo(saved);
  }

  @Test
  void concurrentAllocationReplacementAllowsOnlyOneWriter() throws Exception {
    UUID secondShotId =
        id(
            "INSERT INTO shots(sequence_id,order_index,narrative_purpose) VALUES (?,2,'Reaction') RETURNING id",
            sequenceId);
    UUID firstCueId =
        id(
            "INSERT INTO audio_cues(story_beat_id,order_index,cue_type,adaptation_action,adapted_text,status) VALUES (?,1,'DIALOGUE','KEEP_EXACT','First line', 'APPROVED') RETURNING id",
            storyBeatId);
    UUID secondCueId =
        id(
            "INSERT INTO audio_cues(story_beat_id,order_index,cue_type,adaptation_action,adapted_text,status) VALUES (?,2,'DIALOGUE','KEEP_EXACT','Second line', 'APPROVED') RETURNING id",
            storyBeatId);
    var firstSet =
        List.of(
            new ReplaceShotAudioCueAllocationsUseCase.Assignment(firstCueId, shotId),
            new ReplaceShotAudioCueAllocationsUseCase.Assignment(secondCueId, secondShotId));
    var secondSet =
        List.of(
            new ReplaceShotAudioCueAllocationsUseCase.Assignment(firstCueId, secondShotId),
            new ReplaceShotAudioCueAllocationsUseCase.Assignment(secondCueId, shotId));
    var initial = replaceShotAudioCueAllocations.execute(projectId, sequenceId, 0L, firstSet);
    var start = new CountDownLatch(1);
    var pool = Executors.newFixedThreadPool(2);
    try {
      var writers =
          List.of(
              pool.submit(
                  () -> {
                    await(start);
                    try {
                      return replaceShotAudioCueAllocations.execute(
                          projectId, sequenceId, initial.rowVersion(), firstSet);
                    } catch (ResourceConflictException conflict) {
                      return conflict;
                    }
                  }),
              pool.submit(
                  () -> {
                    await(start);
                    try {
                      return replaceShotAudioCueAllocations.execute(
                          projectId, sequenceId, initial.rowVersion(), secondSet);
                    } catch (ResourceConflictException conflict) {
                      return conflict;
                    }
                  }));
      start.countDown();
      List<Object> results = new ArrayList<>();
      for (var writer : writers) results.add(writer.get(10, TimeUnit.SECONDS));

      assertThat(results)
          .filteredOn(
              com.narrativex.backend.feature.storyboard.application.model.ShotAudioCueAllocationSet
                      .class
                  ::isInstance)
          .hasSize(1);
      assertThat(results).filteredOn(ResourceConflictException.class::isInstance).hasSize(1);
      assertThat(shotAudioCueAllocations.findBySequenceId(sequenceId).orElseThrow().rowVersion())
          .isEqualTo(2L);
    } finally {
      pool.shutdownNow();
    }
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
  void nativeSpeakerProfileWithoutAudioReferencePinsDescriptionForDialogue() {
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
    jdbc.update(
        "INSERT INTO audio_cues(story_beat_id,order_index,cue_type,speaker_project_character_id,adapted_text,delivery_hint,status) VALUES (?,0,'DIALOGUE',?,'Approved dialogue cue','Calm','APPROVED')",
        storyBeatId,
        participation);
    var take = admission.execute(command("native", null));
    var frozen = snapshot(take);
    assertThat(frozen.audioMode()).isEqualTo("LTX_NATIVE_AV");
    assertThat(json.writeValueAsString(frozen.inputs().get("voiceReference")))
        .contains("Adult warm baritone", "Northern Vietnamese");
    assertThat(json.writeValueAsString(frozen.inputs().get("dialogue")))
        .contains("Approved dialogue cue", "Adult warm baritone");
    assertThat(json.writeValueAsString(frozen.context()))
        .contains(version.toString(), voice.toString(), "\"versionNumber\":3");
    jdbc.update(
        "UPDATE character_voice_profiles SET voice_description='Current live voice changed',row_version=row_version+1 WHERE id=?",
        voice);
    assertThat(snapshot(take)).isEqualTo(frozen);
  }

  @Test
  void unsupportedNativeAudioCueTypesRejectBeforeCreatingIntent() {
    UUID cueId =
        id(
            "INSERT INTO audio_cues(story_beat_id,order_index,cue_type,adaptation_action,adapted_text,status) VALUES (?,0,'NARRATOR','KEEP_EXACT','Unsupported cue','APPROVED') RETURNING id",
            storyBeatId);
    int jobsBefore = count("generation_jobs");
    int takesBefore = count("takes");
    int outboxBefore = count("outbox_events");

    for (String cueType : List.of("NARRATOR", "INNER_MONOLOGUE", "SYSTEM")) {
      jdbc.update(
          "UPDATE audio_cues SET cue_type=?, row_version=row_version+1 WHERE id=?", cueType, cueId);
      assertThatThrownBy(() -> admission.execute(command("unsupported-" + cueType, null)))
          .isInstanceOf(DomainValidationException.class)
          .hasMessageContaining("UNSUPPORTED_NATIVE_AUDIO_CUE: " + cueType);
    }

    assertThat(count("generation_jobs")).isEqualTo(jobsBefore);
    assertThat(count("takes")).isEqualTo(takesBefore);
    assertThat(count("outbox_events")).isEqualTo(outboxBefore);
  }

  @Test
  void unsupportedReferencesAndStrategiesRejectBeforeIntent() {
    video.setSupportedStrategies(
        List.of(
            GenerationStrategy.TEXT_TO_VIDEO,
            GenerationStrategy.IMAGE_TO_VIDEO,
            GenerationStrategy.FIRST_LAST_FRAME));
    int initialJobs = count("generation_jobs");
    int initialTakes = count("takes");
    int initialOutbox = count("outbox_events");
    for (var strategy :
        List.of(GenerationStrategy.IMAGE_TO_VIDEO, GenerationStrategy.FIRST_LAST_FRAME)) {
      var command =
          new GenerateShotTakeCommand(
              projectId, shotId, strategy, null, null, null, strategy.name(), null);
      assertThatThrownBy(() -> admission.execute(command))
          .hasMessageContaining("UNSUPPORTED_STRATEGY");
    }
    UUID other =
        id(
            "INSERT INTO projects(name,status,source_language,narration_language,image_aspect_ratio) VALUES ('other','DRAFT','en', 'en','RATIO_16_9') RETURNING id");
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
    assertThatThrownBy(() -> admission.execute(command("reference-other-project", null)))
        .hasMessageContaining("READY assets in this Project");
    jdbc.update(
        "UPDATE media_assets SET project_id=?,status='REJECTED' WHERE id=?", projectId, asset);
    assertThatThrownBy(() -> admission.execute(command("reference-rejected", null)))
        .hasMessageContaining("READY assets in this Project");
    jdbc.update("UPDATE media_assets SET status='READY' WHERE id=?", asset);
    assertThatThrownBy(() -> admission.execute(command("reference-ready", null)))
        .hasMessageContaining("UNSUPPORTED_REFERENCE_CONDITIONING");
    assertThat(count("generation_jobs")).isEqualTo(initialJobs);
    assertThat(count("takes")).isEqualTo(initialTakes);
    assertThat(count("outbox_events")).isEqualTo(initialOutbox);
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
  void restartSubmittingReconcilesSameAttempt() {
    var admitted = admission.execute(command("restart-submitting", 42L));
    UUID attemptId = jobs.findByJobId(admitted.jobId()).orElseThrow().getComputeAttemptId();
    assertThat(claim(admitted.jobId())).isTrue();
    assertThat(jobs.findJobsDueForReconciliation(java.time.Instant.now().plusSeconds(60), 100))
        .filteredOn(job -> job.getJobId().equals(admitted.jobId()))
        .singleElement()
        .satisfies(
            job -> {
              assertThat(job.getComputeAttemptId()).isEqualTo(attemptId);
              assertThat(job.getStatus())
                  .isEqualTo(
                      com.narrativex.backend.feature.generation.domain.enums.JobStatus.SUBMITTING);
            });
    assertThat(jobs.countActiveVideoExecutions()).isEqualTo(1);
    assertThat(claim(admitted.jobId())).isFalse();
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

  @Test
  void ratio16_9_isAdmitted() {
    jdbc.update("UPDATE projects SET image_aspect_ratio = 'RATIO_16_9' WHERE id = ?", projectId);
    int initialJobs = count("generation_jobs");
    var admitted = admission.execute(command("ratio-16-9", 101L));
    assertThat(admitted).isNotNull();
    assertThat(admitted.id()).isNotNull();
    assertThat(count("generation_jobs")).isEqualTo(initialJobs + 1);
  }

  @Test
  void unsupportedRatio9_16_isRejectedBeforeOutbox() {
    jdbc.update("UPDATE projects SET image_aspect_ratio = 'RATIO_9_16' WHERE id = ?", projectId);
    int initialJobs = count("generation_jobs");
    int initialTakes = count("takes");
    assertThatThrownBy(() -> admission.execute(command("ratio-9-16", 102L)))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("UNSUPPORTED_ASPECT_RATIO");
    assertThat(count("generation_jobs")).isEqualTo(initialJobs);
    assertThat(count("takes")).isEqualTo(initialTakes);
  }

  @Test
  void unsupportedRatio1_1_isRejectedBeforeOutbox() {
    jdbc.update("UPDATE projects SET image_aspect_ratio = 'RATIO_1_1' WHERE id = ?", projectId);
    int initialJobs = count("generation_jobs");
    int initialTakes = count("takes");
    assertThatThrownBy(() -> admission.execute(command("ratio-1-1", 103L)))
        .isInstanceOf(DomainValidationException.class)
        .hasMessageContaining("UNSUPPORTED_ASPECT_RATIO");
    assertThat(count("generation_jobs")).isEqualTo(initialJobs);
    assertThat(count("takes")).isEqualTo(initialTakes);
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
