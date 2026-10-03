package com.narrativex.backend.feature.generation.infrastructure.persistence;

import static org.assertj.core.api.Assertions.*;
import com.narrativex.backend.configuration.NarrativeXLimitsProperties;
import com.narrativex.backend.feature.generation.application.command.CreateMediaJobCommand;
import com.narrativex.backend.feature.generation.application.port.out.*;
import com.narrativex.backend.feature.generation.application.usecase.CreateMediaJobUseCase;
import com.narrativex.backend.feature.generation.domain.enums.*;
import com.narrativex.backend.feature.generation.infrastructure.compute.VideoGenerationProperties;
import com.narrativex.backend.support.PostgreSqlIntegrationTestSupport;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class ChapterVideoBatchPostgreSqlIntegrationTest extends PostgreSqlIntegrationTestSupport {
  @Autowired CreateMediaJobUseCase create;
  @Autowired GenerationJobRepository jobs;
  @Autowired MediaGenerationItemRepository items;
  @Autowired NarrativeXLimitsProperties limits;
  @Autowired VideoGenerationProperties video;
  @Autowired JdbcTemplate jdbc;
  @Autowired com.narrativex.backend.feature.generation.infrastructure.dispatch.ComputeExecutionDispatcher dispatcher;
  UUID projectId, chapterId, beatId, storyBeatId, shotId, sequenceId;  @BeforeEach
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
    jdbc.update("UPDATE visual_beats SET visual_direction_json = '{\"shot_size\":\"WIDE\",\"camera_angle\":\"EYE_LEVEL\",\"lens_mm\":35,\"focus_target\":\"hero\",\"action_phase\":\"walking\",\"subject_placement\":\"center\",\"background\":\"room\",\"motivated_light\":\"sun\",\"palette\":\"warm\",\"camera_movement\":\"NONE\",\"movement_intensity\":\"LOW\",\"crop_safe_area\":\"center\"}'::jsonb WHERE id = ?", beatId);
    UUID sequence =
        id("INSERT INTO shot_sequences(visual_beat_id) VALUES (?) RETURNING id", beatId);
    sequenceId = sequence;
    shotId =
        id(
            "INSERT INTO shots(sequence_id,order_index,narrative_purpose) VALUES (?,1,'Hero walks to the door') RETURNING id",
            sequence);
  }

  UUID id(String sql, Object... parameters) { return jdbc.queryForObject(sql, UUID.class, parameters); }
  CreateMediaJobCommand command(String key) {
    return new CreateMediaJobCommand(projectId, chapterId, key, "VIDEO_FIRST", "16:9");
  }
  @AfterEach void reset() { limits.setMaxConcurrentExpensiveJobs(2); }
  @Test void freezesEveryShotAndReplayDoesNotDuplicateItems() {
    id("INSERT INTO shots(sequence_id,order_index,narrative_purpose) VALUES (?,2,'Second shot') RETURNING id",sequenceId);
    id("INSERT INTO shots(sequence_id,order_index,narrative_purpose) VALUES (?,3,'Third shot') RETURNING id",sequenceId);
    var batch = create.execute(command("chapter-three"));
    assertThat(items.findByJobId(batch.getId())).hasSize(3);
    assertThat(items.findByJobId(batch.getId())).extracting(i -> i.getItemKey()).allMatch(k -> k.startsWith("shot-"));
    assertThat(batch.getResourceClass()).isEqualTo(ResourceClass.BACKGROUND);
    assertThat(create.execute(command("chapter-three")).getId()).isEqualTo(batch.getId());
    assertThat(items.findByJobId(batch.getId())).hasSize(3);
    assertThat(jobs.countActiveJobs()).isZero();
  }
  @Test void admitsOnlyAvailableLeavesAndDoesNotCompleteAfterFirstClip() {
    jdbc.update("UPDATE generation_jobs SET status = 'COMPLETED' WHERE status NOT IN ('COMPLETED','FAILED','CANCELED')");
    limits.setMaxConcurrentExpensiveJobs(2);
    id("INSERT INTO shots(sequence_id,order_index,narrative_purpose) VALUES (?,2,'Second shot') RETURNING id",sequenceId);
    id("INSERT INTO shots(sequence_id,order_index,narrative_purpose) VALUES (?,3,'Third shot') RETURNING id",sequenceId);
    var batch = create.execute(command("bounded"));
    dispatcher.dispatchJob(batch.getJobId());
    assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM takes WHERE shot_id IN (SELECT id FROM shots WHERE sequence_id = ?)",Integer.class,sequenceId)).isEqualTo(2);
    assertThat(jobs.findById(batch.getId()).orElseThrow().getStatus()).isEqualTo(JobStatus.RUNNING);
    assertThat(jobs.countActiveJobs()).isEqualTo(2);
  }
}

