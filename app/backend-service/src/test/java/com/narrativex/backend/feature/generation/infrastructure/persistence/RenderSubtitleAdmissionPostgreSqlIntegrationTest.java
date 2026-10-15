package com.narrativex.backend.feature.generation.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.narrativex.backend.feature.generation.application.command.CreateProjectRenderCommand;
import com.narrativex.backend.feature.generation.application.render.ProjectSubtitleSettings;
import com.narrativex.backend.feature.generation.application.render.SubtitleStyle;
import com.narrativex.backend.feature.generation.application.usecase.CreateProjectRenderUseCase;
import com.narrativex.backend.feature.generation.application.usecase.GetProductionTimelineUseCase;
import com.narrativex.backend.feature.generation.application.usecase.ProjectSubtitleSettingsUseCase;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import com.narrativex.backend.feature.localexecution.application.usecase.LocalDeviceUseCase;
import com.narrativex.backend.feature.localexecution.application.usecase.LocalDeviceUseCase.PairDeviceCommand;
import com.narrativex.backend.support.PostgreSqlIntegrationTestSupport;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class RenderSubtitleAdmissionPostgreSqlIntegrationTest extends PostgreSqlIntegrationTestSupport {
  private static final String SOURCE_HASH = "a".repeat(64);
  private static final SubtitleStyle WHITE = SubtitleStyle.defaults();
  private static final SubtitleStyle RED =
      new SubtitleStyle(
          2,
          "BOTTOM_CENTER",
          "DEFAULT",
          "Arial",
          700,
          0.034,
          0.07,
          "#FF0000",
          "#000000",
          "#000000",
          0.75);

  @Autowired private JdbcTemplate jdbc;
  @Autowired private CreateProjectRenderUseCase admission;
  @Autowired private GetProductionTimelineUseCase timelines;
  @Autowired private ProjectSubtitleSettingsUseCase subtitles;
  @Autowired private LocalDeviceUseCase devices;

  private UUID projectId;
  private UUID deviceId;
  private UUID alignmentId;
  private UUID mediaId;

  @BeforeEach
  void seedReadyLegacyTimeline() {
    // Metadata fixtures prove admission/storage only; they do not execute media or providers.
    projectId =
        id(
            "INSERT INTO projects(name,status,source_language,narration_language,image_aspect_ratio) VALUES ('Subtitle admission','ACTIVE','vi-VN', 'vi-VN','RATIO_16_9') RETURNING id");
    UUID storyId =
        id(
            "INSERT INTO story_versions(project_id,version_number,content,source_language,status) VALUES (?,1,'Xin chào','vi-VN','ACTIVE') RETURNING id",
            projectId);
    UUID chapterId =
        id(
            "INSERT INTO chapters(story_version_id,order_index,title,source_text,source_hash,status,estimated_duration_ms) VALUES (?,0,'Chapter','Xin chào',?,'READY',1000) RETURNING id",
            storyId,
            SOURCE_HASH);
    UUID revisionId =
        id(
            "INSERT INTO storyboard_revisions(chapter_id,revision_number,source_hash,source_row_version) VALUES (?,1,?,0) RETURNING id",
            chapterId,
            SOURCE_HASH);
    jdbc.update(
        "UPDATE chapters SET current_storyboard_revision_id=? WHERE id=?", revisionId, chapterId);
    UUID sceneId =
        id(
            "INSERT INTO scenes(storyboard_revision_id,chapter_id,project_id,order_index,title) VALUES (?,?,?,0,'Scene') RETURNING id",
            revisionId,
            chapterId,
            projectId);
    UUID storyBeatId =
        id(
            "INSERT INTO story_beats(scene_id,order_index,summary,review_status) VALUES (?,0,'Greeting','APPROVED') RETURNING id",
            sceneId);
    mediaId = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO media_assets(id,project_id,asset_type,origin,storage_key,original_filename,content_type,size_bytes,sha256,duration_ms,status) VALUES (?,?,'VIDEO','USER_UPLOAD',?,'greeting.mp4','video/mp4',1000,?,1000,'READY')",
        mediaId,
        projectId,
        "local/video/" + mediaId + ".mp4",
        "e".repeat(64));
    id(
        "INSERT INTO visual_beats(scene_id,story_beat_id,order_index,title,visual_intent,review_status,text_start,text_end,preview_media_asset_id) VALUES (?,?,0,'Greeting','A greeting','APPROVED',0,8,?) RETURNING id",
        sceneId,
        storyBeatId,
        mediaId);
    UUID audioAssetId =
        id(
            "INSERT INTO project_assets(project_id,name,asset_type,storage_key,mime_type,status,metadata_json) VALUES (?,'chapter.wav','AUDIO',?,'audio/wav','ACTIVE','{}'::jsonb) RETURNING id",
            projectId,
            "local/audio/" + projectId + ".wav");
    UUID narrationRequestId =
        id(
            "INSERT INTO narration_requests(id,project_id,chapter_id,chapter_row_version,source_hash,source_text,voice_id,language,speaking_rate,segmentation_version,request_fingerprint) VALUES (uuidv7(),?,?,0,?,'Xin chào','voice','vi-VN',1.0,'v1',?) RETURNING id",
            projectId,
            chapterId,
            SOURCE_HASH,
            "b".repeat(64));
    UUID narrationAssetId =
        id(
            "INSERT INTO narration_assets(id,narration_request_id,project_asset_id,duration_ms,size_bytes,codec,sample_rate_hz,channels,checksum) VALUES (uuidv7(),?,?,1000,1000,'PCM_S16LE',48000,2,?) RETURNING id",
            narrationRequestId,
            audioAssetId,
            "c".repeat(64));
    alignmentId =
        id(
            "INSERT INTO narration_alignments(id,narration_asset_id,source_hash,alignment_version,words_json) VALUES (uuidv7(),?,?,'whisperx-forced-v1',CAST(? AS jsonb)) RETURNING id",
            narrationAssetId,
            SOURCE_HASH,
            """
        [{"index":0,"textStart":0,"textEnd":3,"audioStartMs":120,"audioEndMs":420,"confidence":0.99},
         {"index":1,"textStart":4,"textEnd":8,"audioStartMs":500,"audioEndMs":880,"confidence":0.98}]
        """);
    deviceId =
        devices
            .pair(
                new PairDeviceCommand(
                    devices.createPairingCode().code(),
                    "CI Desktop",
                    "test",
                    "1.0",
                    List.of("PROJECT_RENDER")))
            .deviceId();
  }

  @Test
  void requestStyleDefinesReplayIdentityAndImmutableSnapshotIndependentlyOfPreferences() {
    var timeline = timelines.execute(projectId);
    assertThat(timeline.readyForRender()).isTrue();
    assertThat(timeline.audioMode()).isEqualTo("EXTERNAL_NARRATION");
    assertThat(timeline.chapters())
        .singleElement()
        .satisfies(chapter -> assertThat(chapter.narrationAlignmentId()).isEqualTo(alignmentId));
    assertThat(timeline.beats())
        .singleElement()
        .satisfies(beat -> assertThat(beat.mediaAssetId()).isEqualTo(mediaId));

    subtitles.save(projectId, new ProjectSubtitleSettings(true, WHITE));
    var whiteCommand = command("keyA", WHITE);
    var first = admission.execute(whiteCommand);
    assertSnapshotStyle(first.getId(), WHITE);
    String whiteProfile = profile(first.getId());

    subtitles.save(projectId, new ProjectSubtitleSettings(true, RED));
    var replay = admission.execute(whiteCommand);
    assertThat(replay.getId()).isEqualTo(first.getId());
    assertThat(profile(first.getId())).isEqualTo(whiteProfile);
    assertThat(jobCount()).isEqualTo(1);

    // The submitted style must win even when saved preferences still contain white.
    subtitles.save(projectId, new ProjectSubtitleSettings(true, WHITE));
    var second = admission.execute(command("keyB", RED));
    assertThat(second.getId()).isNotEqualTo(first.getId());
    assertThat(second.getSourceHash()).isNotEqualTo(first.getSourceHash());
    assertSnapshotStyle(second.getId(), RED);
    String redProfile = profile(second.getId());
    subtitles.save(projectId, new ProjectSubtitleSettings(false, WHITE));
    assertThat(profile(first.getId())).isEqualTo(whiteProfile);
    assertThat(profile(second.getId())).isEqualTo(redProfile);

    assertThatThrownBy(() -> admission.execute(command("keyA", RED)))
        .isInstanceOf(GenerationAdmissionDeniedException.class)
        .satisfies(
            exception ->
                assertThat(((GenerationAdmissionDeniedException) exception).getCode())
                    .isEqualTo("IDEMPOTENCY_CONFLICT"));
    assertThat(jobCount()).isEqualTo(2);
    assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM project_render_input_snapshots WHERE project_id=?",
                Integer.class,
                projectId))
        .isEqualTo(2);
    assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM stage_attempts s JOIN generation_jobs j ON j.id=s.generation_job_id WHERE j.project_id=?",
                Integer.class,
                projectId))
        .isEqualTo(2);
    assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM operation_plans WHERE project_id=?",
                Integer.class,
                projectId))
        .isEqualTo(2);
  }

  private CreateProjectRenderCommand command(String key, SubtitleStyle style) {
    return new CreateProjectRenderCommand(
        projectId, "720p", "mp4", key, deviceId, 24, true, List.of(), style);
  }

  private void assertSnapshotStyle(UUID jobId, SubtitleStyle style) {
    assertThat(
            jdbc.queryForObject(
                "SELECT render_profile_json #> '{subtitles,style}' = CAST(? AS jsonb) AND render_profile_json #>> '{subtitles,mode}' = 'burn_in' FROM project_render_input_snapshots WHERE generation_job_id=?",
                Boolean.class,
                style.toJson(),
                jobId))
        .isTrue();
  }

  private String profile(UUID jobId) {
    return jdbc.queryForObject(
        "SELECT render_profile_json::text FROM project_render_input_snapshots WHERE generation_job_id=?",
        String.class,
        jobId);
  }

  private int jobCount() {
    return jdbc.queryForObject(
        "SELECT COUNT(*) FROM generation_jobs WHERE project_id=?", Integer.class, projectId);
  }

  private UUID id(String sql, Object... params) {
    return jdbc.queryForObject(sql, UUID.class, params);
  }
}
