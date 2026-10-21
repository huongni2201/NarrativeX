package com.narrativex.backend.feature.generation.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.application.model.compute.OutputArtifactTargetDto;
import com.narrativex.backend.feature.generation.application.model.compute.ProducedArtifactDto;
import com.narrativex.backend.feature.generation.application.port.out.ComputeArtifactAccess;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.NarrationAssetRepository;
import com.narrativex.backend.feature.generation.application.port.out.NarrationRequestRepository;
import com.narrativex.backend.feature.generation.application.port.out.StageAttemptRepository;
import com.narrativex.backend.feature.generation.application.service.InvalidComputeOutputException;
import com.narrativex.backend.feature.generation.application.service.NarrationAlignmentAdmission;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.entity.StageAttempt;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import com.narrativex.backend.feature.generation.infrastructure.finalizer.NarrationGenerationResultFinalizer;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.NarrationMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.NarrationOperationRow;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ProductionTimelineMapper;
import com.narrativex.backend.support.PostgreSqlIntegrationTestSupport;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/**
 * Narration audio only reaches the timeline through narration_assets and narration_alignments, so
 * these tests drive the real finalizer against PostgreSQL with a stubbed worker artifact store.
 */
@SpringBootTest
@ActiveProfiles("test")
class NarrationPipelinePostgreSqlIntegrationTest extends PostgreSqlIntegrationTestSupport {
  private static final String SCRIPT = "Xin chao the gioi";
  private static final String SOURCE_HASH = "a".repeat(64);
  private static final String SHA = "b".repeat(64);

  @Autowired JdbcTemplate jdbc;
  @Autowired GenerationJobRepository jobs;
  @Autowired StageAttemptRepository stageAttempts;
  @Autowired NarrationRequestRepository requests;
  @Autowired NarrationAssetRepository narrationAssets;
  @Autowired NarrationMapper narrationMapper;
  @Autowired MediaAssetRepository mediaAssets;
  @Autowired NarrationAlignmentAdmission alignmentAdmission;
  @Autowired ProductionTimelineMapper timelineMapper;

  ComputeArtifactAccess artifacts;
  NarrationGenerationResultFinalizer finalizer;
  UUID projectId, storyId, chapterId, requestId;

  @BeforeEach
  void seed() {
    projectId =
        id(
            "INSERT INTO projects(name,status,source_language,narration_language,image_aspect_ratio) VALUES ('narration','ACTIVE','vi-VN','vi-VN','RATIO_16_9') RETURNING id");
    storyId =
        id(
            "INSERT INTO story_versions(project_id,version_number,content,source_language,status) VALUES (?,1,'Xin chao','vi-VN','ACTIVE') RETURNING id",
            projectId);
    chapterId =
        id(
            "INSERT INTO chapters(story_version_id,order_index,title,source_text,source_hash) VALUES (?,0,'Chapter',?,?) RETURNING id",
            storyId,
            SCRIPT,
            SOURCE_HASH);
    requestId =
        id(
            "INSERT INTO narration_requests(id,project_id,chapter_id,chapter_row_version,source_hash,source_text,voice_id,language,speaking_rate,segmentation_version,request_fingerprint) VALUES (uuidv7(),?,?,0,?,?,'voice','vi-VN',1.0,'v1',?) RETURNING id",
            projectId,
            chapterId,
            SOURCE_HASH,
            SCRIPT,
            UUID.randomUUID().toString().replace("-", "").repeat(2));
    artifacts = mock(ComputeArtifactAccess.class);
    finalizer =
        new NarrationGenerationResultFinalizer(
            jobs, mediaAssets, artifacts, requests, narrationAssets, alignmentAdmission);
  }

  @Test
  void synthesisRegistersTheAudioMasterAndAdmitsItsAlignment() {
    GenerationJob job = synthesisJob("chapter-narration:" + UUID.randomUUID());
    UUID audioId = UuidV7.random();
    stubAudio(audioId, wav(48_000, 1, 3 * 48_000));

    finalizer.finalizeResult(job, succeeded(job, produced(audioId, "narration", "audio/wav")));

    var asset = narrationAssets.findCurrentByMediaAssetId(audioId).orElseThrow();
    assertThat(asset.durationMs()).isEqualTo(3_000L);
    assertThat(asset.sourceHash()).isEqualTo(SOURCE_HASH);
    assertThat(
            jdbc.queryForObject(
                "SELECT status FROM project_assets WHERE id = ?", String.class, audioId))
        .isEqualTo("ACTIVE");
    assertThat(jobs.findByJobId(job.getJobId()).orElseThrow().getStatus())
        .isEqualTo(JobStatus.COMPLETED);

    GenerationJob alignment =
        jobs.findByIdempotencyKey(NarrationAlignmentAdmission.KEY_PREFIX + audioId).orElseThrow();
    assertThat(alignment.getStatus()).isEqualTo(JobStatus.QUEUED);
    assertThat(alignment.getType()).isEqualTo(JobType.NARRATION_GENERATE);
    assertThat(alignment.getSourceText()).isEqualTo(SCRIPT);
    assertThat(NarrationAlignmentAdmission.alignedMediaAssetId(alignment)).isEqualTo(audioId);
  }

  @Test
  void voicePreviewRegistersAudioWithoutAlignment() {
    GenerationJob job = synthesisJob("voice-preview:" + UUID.randomUUID());
    UUID audioId = UuidV7.random();
    stubAudio(audioId, wav(48_000, 1, 48_000));

    finalizer.finalizeResult(job, succeeded(job, produced(audioId, "narration", "audio/wav")));

    assertThat(narrationAssets.findCurrentByMediaAssetId(audioId)).isPresent();
    assertThat(jobs.findByIdempotencyKey(NarrationAlignmentAdmission.KEY_PREFIX + audioId))
        .isEmpty();
  }

  @Test
  void audioOutsideTheNarrationMasterFormatIsRejectedBeforeAnythingIsRegistered() {
    GenerationJob job = synthesisJob("chapter-narration:" + UUID.randomUUID());
    UUID audioId = UuidV7.random();
    stubAudio(audioId, wav(44_100, 2, 44_100));

    assertThatThrownBy(
            () ->
                finalizer.finalizeResult(
                    job, succeeded(job, produced(audioId, "narration", "audio/wav"))))
        .isInstanceOf(InvalidComputeOutputException.class)
        .hasMessageContaining("48 kHz mono");

    assertThat(narrationAssets.findCurrentByMediaAssetId(audioId)).isEmpty();
  }

  @Test
  void alignmentFeedsTheProductionTimelineClock() {
    UUID audioId = synthesizeChapterNarration();
    GenerationJob alignment =
        jobs.findByIdempotencyKey(NarrationAlignmentAdmission.KEY_PREFIX + audioId).orElseThrow();
    UUID alignmentArtifact = UuidV7.random();
    byte[] words =
        ("[{\"index\":0,\"textStart\":0,\"textEnd\":3,\"audioStartMs\":0,\"audioEndMs\":900,\"confidence\":0.9},"
                + "{\"index\":1,\"textStart\":4,\"textEnd\":7,\"audioStartMs\":900,\"audioEndMs\":3020,\"confidence\":0.9}]")
            .getBytes(StandardCharsets.UTF_8);
    stubOutput(alignmentArtifact, "alignment", "application/json", words);

    finalizer.finalizeResult(
        alignment,
        succeeded(alignment, produced(alignmentArtifact, "alignment", "application/json")));

    var row = timelineMapper.findChapters(projectId).getFirst();
    assertThat(row.getNarrationAssetId()).isNotNull();
    assertThat(row.getNarrationAlignmentId()).isNotNull();
    // The last word ends 20 ms past the 3 s audio; the stored clock is clamped to the audio.
    assertThat(row.getSubtitleWordsJson()).contains("\"audioEndMs\": 3000");
    assertThat(jobs.findByJobId(alignment.getJobId()).orElseThrow().getStatus())
        .isEqualTo(JobStatus.COMPLETED);
  }

  @Test
  void regeneratingNarrationReplacesTheAudioAndDropsTheStaleAlignment() {
    UUID firstAudio = synthesizeChapterNarration();
    GenerationJob firstAlignment =
        jobs.findByIdempotencyKey(NarrationAlignmentAdmission.KEY_PREFIX + firstAudio)
            .orElseThrow();
    UUID alignmentArtifact = UuidV7.random();
    stubOutput(
        alignmentArtifact,
        "alignment",
        "application/json",
        "[{\"index\":0,\"textStart\":0,\"textEnd\":3,\"audioStartMs\":0,\"audioEndMs\":900,\"confidence\":0.9}]"
            .getBytes(StandardCharsets.UTF_8));
    finalizer.finalizeResult(
        firstAlignment,
        succeeded(firstAlignment, produced(alignmentArtifact, "alignment", "application/json")));
    assertThat(alignmentCount()).isEqualTo(1);

    GenerationJob secondJob = synthesisJob("chapter-narration:" + UUID.randomUUID() + ":retry");
    UUID secondAudio = UuidV7.random();
    stubAudio(secondAudio, wav(48_000, 1, 5 * 48_000));
    finalizer.finalizeResult(
        secondJob, succeeded(secondJob, produced(secondAudio, "narration", "audio/wav")));

    assertThat(assetCount()).isEqualTo(1);
    assertThat(alignmentCount()).isZero();
    assertThat(narrationAssets.findCurrentByMediaAssetId(firstAudio)).isEmpty();
    assertThat(narrationAssets.findCurrentByMediaAssetId(secondAudio).orElseThrow().durationMs())
        .isEqualTo(5_000L);
    assertThat(
            jdbc.queryForObject(
                "SELECT status FROM project_assets WHERE id = ?", String.class, firstAudio))
        .isEqualTo("ARCHIVED");

    // A late result for the replaced audio must not attach timing to the new bytes.
    UUID lateArtifact = UuidV7.random();
    stubOutput(
        lateArtifact,
        "alignment",
        "application/json",
        "[{\"index\":0,\"textStart\":0,\"textEnd\":3,\"audioStartMs\":0,\"audioEndMs\":900,\"confidence\":0.9}]"
            .getBytes(StandardCharsets.UTF_8));
    GenerationJob staleAlignment =
        jobs.findByIdempotencyKey(NarrationAlignmentAdmission.KEY_PREFIX + firstAudio)
            .orElseThrow();
    jdbc.update(
        "UPDATE generation_jobs SET status = 'RUNNING' WHERE id = ?", staleAlignment.getId());
    finalizer.finalizeResult(
        jobs.findById(staleAlignment.getId()).orElseThrow(),
        succeeded(staleAlignment, produced(lateArtifact, "alignment", "application/json")));
    assertThat(alignmentCount()).isZero();
  }

  @Test
  void admissionIsIdempotentPerAudio() {
    GenerationJob job = synthesisJob("chapter-narration:" + UUID.randomUUID());
    UUID audioId = UuidV7.random();

    var first = alignmentAdmission.admit(job, audioId);
    var second = alignmentAdmission.admit(job, audioId);

    assertThat(second.getId()).isEqualTo(first.getId());
    assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM generation_jobs WHERE idempotency_key = ?",
                Integer.class,
                NarrationAlignmentAdmission.KEY_PREFIX + audioId))
        .isEqualTo(1);
  }

  // ---- helpers ----

  UUID synthesizeChapterNarration() {
    GenerationJob job = synthesisJob("chapter-narration:" + UUID.randomUUID());
    UUID audioId = UuidV7.random();
    stubAudio(audioId, wav(48_000, 1, 3 * 48_000));
    finalizer.finalizeResult(job, succeeded(job, produced(audioId, "narration", "audio/wav")));
    return audioId;
  }

  GenerationJob synthesisJob(String idempotencyKey) {
    GenerationJob job =
        jobs.save(
            GenerationJob.rehydrate(
                null,
                0L,
                UuidV7.random(),
                projectId,
                JobType.NARRATION_GENERATE,
                JobStatus.QUEUED,
                ResourceClass.PROVIDER_INTERACTIVE,
                0,
                "QUEUED",
                null,
                storyId,
                chapterId,
                null,
                0L,
                SOURCE_HASH,
                SCRIPT,
                "vi-VN",
                idempotencyKey));
    StageAttempt attempt =
        stageAttempts.create(StageAttempt.create(job.getId(), "NARRATION_GENERATE", 1));
    narrationMapper.insertOperation(
        new NarrationOperationRow(UuidV7.random(), requestId, job.getId(), attempt.getId()));
    return job;
  }

  void stubAudio(UUID artifactId, byte[] wav) {
    stubOutput(artifactId, "narration", "audio/wav", wav);
  }

  void stubOutput(UUID artifactId, String role, String mediaType, byte[] bytes) {
    var target = new OutputArtifactTargetDto(artifactId, role, mediaType, null);
    when(artifacts.getOrCreateTarget(any(), any(), eq(artifactId), eq(role), eq(mediaType)))
        .thenReturn(target);
    when(artifacts.readOutput(target)).thenReturn(bytes);
    when(artifacts.storageKey(target))
        .thenReturn("private/provider-results/task/attempt/" + artifactId + ".bin");
  }

  static ProducedArtifactDto produced(UUID artifactId, String role, String mediaType) {
    return new ProducedArtifactDto(artifactId, role, mediaType, 1_000L, SHA);
  }

  static ComputeObservationDto succeeded(GenerationJob job, ProducedArtifactDto output) {
    return new ComputeObservationDto(
        "1.0",
        job.getJobId(),
        UuidV7.random(),
        "SUCCEEDED",
        1,
        Instant.now(),
        "handle",
        1.0,
        List.of(output),
        null,
        null);
  }

  /** Uncompressed PCM WAV of silence with a canonical 44-byte header. */
  static byte[] wav(int sampleRate, int channels, int frames) {
    int dataBytes = frames * channels * 2;
    ByteBuffer buffer = ByteBuffer.allocate(44 + dataBytes).order(ByteOrder.LITTLE_ENDIAN);
    buffer.put("RIFF".getBytes(StandardCharsets.US_ASCII)).putInt(36 + dataBytes);
    buffer.put("WAVE".getBytes(StandardCharsets.US_ASCII));
    buffer.put("fmt ".getBytes(StandardCharsets.US_ASCII)).putInt(16);
    buffer.putShort((short) 1).putShort((short) channels).putInt(sampleRate);
    buffer.putInt(sampleRate * channels * 2).putShort((short) (channels * 2)).putShort((short) 16);
    buffer.put("data".getBytes(StandardCharsets.US_ASCII)).putInt(dataBytes);
    return buffer.array();
  }

  UUID id(String sql, Object... params) {
    return jdbc.queryForObject(sql, UUID.class, params);
  }

  int assetCount() {
    return jdbc.queryForObject(
        "SELECT COUNT(*) FROM narration_assets WHERE narration_request_id = ?",
        Integer.class,
        requestId);
  }

  int alignmentCount() {
    return jdbc.queryForObject(
        "SELECT COUNT(*) FROM narration_alignments nal JOIN narration_assets na ON na.id = nal.narration_asset_id WHERE na.narration_request_id = ?",
        Integer.class,
        requestId);
  }
}
