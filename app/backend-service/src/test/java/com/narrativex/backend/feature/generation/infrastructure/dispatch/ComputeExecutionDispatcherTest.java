package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisException;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisRequest;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisResult;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisUsage;
import com.narrativex.backend.feature.generation.application.model.compute.ArtifactWriteAccessDto;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeTaskRequest;
import com.narrativex.backend.feature.generation.application.model.compute.OutputArtifactTargetDto;
import com.narrativex.backend.feature.generation.application.model.compute.ProducedArtifactDto;
import com.narrativex.backend.feature.generation.application.model.compute.SubmitTaskResult;
import com.narrativex.backend.feature.generation.application.port.out.ChapterAnalysisProvider;
import com.narrativex.backend.feature.generation.application.port.out.ChapterAnalysisRunRepository;
import com.narrativex.backend.feature.generation.application.port.out.ComputeArtifactAccess;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.entity.ChapterAnalysisRun;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.SceneRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.StoryboardMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.VisualBeatRow;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class ComputeExecutionDispatcherTest {
  private static final String VALID_ANALYSIS_JSON =
      "{\"scenes\":[{\"title\":\"Scene\",\"narration\":\"Chapter text content\","
          + "\"visual_beats\":[{\"title\":\"Beat\",\"visual_intent\":\"A frame\","
          + "\"source_anchor\":\"Chapter text content\",\"visual_direction\":{"
          + "\"shot_size\":\"WIDE\",\"camera_angle\":\"EYE_LEVEL\",\"lens_mm\":35,"
          + "\"focus_target\":\"subject\",\"action_phase\":\"BEFORE\","
          + "\"subject_placement\":\"center\",\"background\":\"room\","
          + "\"motivated_light\":\"soft\",\"palette\":\"warm\","
          + "\"camera_movement\":\"NONE\",\"movement_intensity\":\"SUBTLE\","
          + "\"crop_safe_area\":\"full\"}}]}]}";

  private GenerationJobRepository generationJobRepository;
  private GenerationExecutionPort executionPort;
  private StoryboardMapper storyboardMapper;
  private ChapterMapper chapterMapper;
  private ComputeArtifactAccess artifactAccess;
  private MediaAssetRepository mediaAssetRepository;
  private ChapterAnalysisProvider chapterAnalysisProvider;
  private ChapterAnalysisRunRepository analysisRunRepository;
  private Map<UUID, OutputArtifactTargetDto> targetsByTask;
  private ComputeExecutionDispatcher dispatcher;

  @BeforeEach
  void setUp() {
    generationJobRepository = mock(GenerationJobRepository.class);
    executionPort = mock(GenerationExecutionPort.class);
    storyboardMapper = mock(StoryboardMapper.class);
    chapterMapper = mock(ChapterMapper.class);
    artifactAccess = mock(ComputeArtifactAccess.class);
    mediaAssetRepository = mock(MediaAssetRepository.class);
    chapterAnalysisProvider = mock(ChapterAnalysisProvider.class);
    analysisRunRepository = mock(ChapterAnalysisRunRepository.class);
    targetsByTask = new HashMap<>();
    when(artifactAccess.readOutput(any(OutputArtifactTargetDto.class)))
        .thenReturn(VALID_ANALYSIS_JSON.getBytes());

    when(chapterAnalysisProvider.analyze(any(ChapterAnalysisRequest.class)))
        .thenReturn(
            new ChapterAnalysisResult(
                VALID_ANALYSIS_JSON,
                new ChapterAnalysisUsage(100, 50, 20, 0, 150, 200),
                "gemini-3.8-flash",
                "test-canon-hash"));

    dispatcher =
        new ComputeExecutionDispatcher(
            generationJobRepository,
            executionPort,
            storyboardMapper,
            chapterMapper,
            artifactAccess,
            mediaAssetRepository,
            chapterAnalysisProvider,
            null,
            null,
            analysisRunRepository);

    when(artifactAccess.createOutput(
            any(UUID.class), any(UUID.class), any(String.class), any(String.class)))
        .thenAnswer(
            invocation -> {
              UUID taskId = invocation.getArgument(0);
              UUID artifactId = UuidV7.random();
              OutputArtifactTargetDto target =
                  new OutputArtifactTargetDto(
                      artifactId,
                      invocation.getArgument(2),
                      invocation.getArgument(3),
                      new ArtifactWriteAccessDto(
                          "PUT",
                          "https://example.test/" + artifactId,
                          Instant.now().plusSeconds(300),
                          Map.of()));
              targetsByTask.put(taskId, target);
              return target;
            });

    when(executionPort.submitTask(any(ComputeTaskRequest.class)))
        .thenAnswer(
            invocation -> {
              ComputeTaskRequest req = invocation.getArgument(0);
              return new SubmitTaskResult(req.taskId(), req.attemptId(), "ACCEPTED");
            });

    when(executionPort.queryTask(any(UUID.class), any(UUID.class)))
        .thenAnswer(
            invocation ->
                new ComputeObservationDto(
                    "1.0",
                    invocation.getArgument(0),
                    invocation.getArgument(1),
                    "SUCCEEDED",
                    1,
                    Instant.now(),
                    "handle:123",
                    1.0,
                    List.of(producedFor(targetsByTask.get(invocation.getArgument(0)))),
                    null,
                    null));
  }

  private static ProducedArtifactDto producedFor(OutputArtifactTargetDto target) {
    return new ProducedArtifactDto(
        target.artifactId(), target.role(), target.mediaType(), 4, "a".repeat(64));
  }

  @Test
  void handlesChapterAnalysisSuccessfully() {
    UUID projectId = UuidV7.random();
    UUID chapterId = UuidV7.random();
    UUID revisionId = UuidV7.random();
    String sourceHash = "a".repeat(64);

    GenerationJob job =
        GenerationJob.createChapterAnalysis(
            projectId,
            UuidV7.random(),
            chapterId,
            revisionId,
            1L,
            sourceHash,
            "Chapter text content",
            "vi",
            "key:analysis:1",
            "IMAGE",
            "API");

    when(generationJobRepository.findByJobId(job.getJobId())).thenReturn(Optional.of(job));
    when(generationJobRepository.save(any(GenerationJob.class))).thenAnswer(i -> i.getArgument(0));
    when(storyboardMapper.findCurrentScenes(chapterId)).thenReturn(List.of());
    when(storyboardMapper.insertScene(any(SceneRow.class))).thenReturn(UuidV7.random());
    when(storyboardMapper.insertVisualBeat(any(VisualBeatRow.class))).thenReturn(UuidV7.random());
    when(chapterMapper.findById(chapterId)).thenReturn(new ChapterRow());
    when(chapterMapper.update(any(ChapterRow.class))).thenReturn(1);

    dispatcher.dispatchJob(job.getJobId());

    ArgumentCaptor<GenerationJob> captor = ArgumentCaptor.forClass(GenerationJob.class);
    verify(generationJobRepository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
    GenerationJob finalState = captor.getValue();
    assertEquals(JobStatus.COMPLETED, finalState.getStatus());
    verify(chapterAnalysisProvider).analyze(any(ChapterAnalysisRequest.class));
    verify(executionPort, never()).submitTask(any(ComputeTaskRequest.class));
    verify(storyboardMapper).insertScene(any(SceneRow.class));

    ArgumentCaptor<VisualBeatRow> beatCaptor = ArgumentCaptor.forClass(VisualBeatRow.class);
    verify(storyboardMapper).insertVisualBeat(beatCaptor.capture());
    VisualBeatRow persistedBeat = beatCaptor.getValue();
    assertEquals(0, persistedBeat.getTextStart());
    assertEquals(20, persistedBeat.getTextEnd());
    assertNotNull(persistedBeat.getSourceAnchorJson());
    assertTrue(persistedBeat.getSourceAnchorJson().contains("\"textStart\":0"));
    assertTrue(persistedBeat.getSourceAnchorJson().contains("\"textEnd\":20"));
    assertTrue(persistedBeat.getSourceAnchorJson().contains("\"sourceHash\":\"" + sourceHash + "\""));

    ArgumentCaptor<ChapterAnalysisRun> runCaptor = ArgumentCaptor.forClass(ChapterAnalysisRun.class);
    verify(analysisRunRepository).recordRun(runCaptor.capture());
    ChapterAnalysisRun recordedRun = runCaptor.getValue();
    assertEquals(chapterId, recordedRun.chapterId());
    assertEquals(job.getId(), recordedRun.generationJobId());
    assertEquals(revisionId, recordedRun.storyboardRevisionId());
    assertEquals(sourceHash, recordedRun.sourceHash());
    assertEquals("gemini-3.8-flash", recordedRun.model());
    assertEquals("test-canon-hash", recordedRun.canonHash());
    assertEquals(100, recordedRun.promptTokens());
    assertEquals(50, recordedRun.outputTokens());
    assertEquals(20, recordedRun.thinkingTokens());
    assertEquals(0, recordedRun.cachedTokens());
    assertEquals(150, recordedRun.totalTokens());
    assertEquals(200, recordedRun.runtimeMs());
  }

  @Test
  void handlesImageGenerationSuccessfully() {
    UUID projectId = UuidV7.random();
    GenerationJob job =
        GenerationJob.create(projectId, JobType.CHAPTER_GENERATE, ResourceClass.PROVIDER_BATCH);

    when(generationJobRepository.findByJobId(job.getJobId())).thenReturn(Optional.of(job));
    when(generationJobRepository.save(any(GenerationJob.class))).thenAnswer(i -> i.getArgument(0));
    dispatcher.dispatchJob(job.getJobId());

    ArgumentCaptor<GenerationJob> captor = ArgumentCaptor.forClass(GenerationJob.class);
    verify(generationJobRepository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
    GenerationJob finalState = captor.getValue();
    assertEquals(JobStatus.COMPLETED, finalState.getStatus());
    verify(executionPort).submitTask(any(ComputeTaskRequest.class));
  }

  @Test
  void doesNotCompleteImageGenerationWithoutProducedArtifact() {
    UUID projectId = UuidV7.random();
    GenerationJob job =
        GenerationJob.create(projectId, JobType.CHAPTER_GENERATE, ResourceClass.PROVIDER_BATCH);

    when(generationJobRepository.findByJobId(job.getJobId())).thenReturn(Optional.of(job));
    when(generationJobRepository.save(any(GenerationJob.class))).thenAnswer(i -> i.getArgument(0));
    when(executionPort.queryTask(any(UUID.class), any(UUID.class)))
        .thenReturn(
            new ComputeObservationDto(
                "1.0",
                job.getJobId(),
                UuidV7.random(),
                "SUCCEEDED",
                1,
                Instant.now(),
                "handle:missing",
                1.0,
                List.of(),
                null,
                null));

    dispatcher.dispatchJob(job.getJobId());

    ArgumentCaptor<GenerationJob> captor = ArgumentCaptor.forClass(GenerationJob.class);
    verify(generationJobRepository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
    GenerationJob finalState = captor.getValue();
    assertNotEquals(JobStatus.COMPLETED, finalState.getStatus());
  }

  @Test
  void doesNotCreateSyntheticStoryboardWhenAnalysisHasNoOutput() {
    UUID projectId = UuidV7.random();
    UUID chapterId = UuidV7.random();
    UUID revisionId = UuidV7.random();
    GenerationJob job =
        GenerationJob.createChapterAnalysis(
            projectId,
            UuidV7.random(),
            chapterId,
            revisionId,
            1L,
            "a".repeat(64),
            "Chapter text content",
            "vi",
            "key:analysis:missing-output",
            "IMAGE",
            "API");

    when(generationJobRepository.findByJobId(job.getJobId())).thenReturn(Optional.of(job));
    when(generationJobRepository.save(any(GenerationJob.class))).thenAnswer(i -> i.getArgument(0));
    when(storyboardMapper.findCurrentScenes(chapterId)).thenReturn(List.of());
    when(chapterAnalysisProvider.analyze(any(ChapterAnalysisRequest.class)))
        .thenThrow(
            new ChapterAnalysisException.ProviderUnavailableException(
                "Analysis output unavailable"));

    dispatcher.dispatchJob(job.getJobId());

    ArgumentCaptor<GenerationJob> captor = ArgumentCaptor.forClass(GenerationJob.class);
    verify(generationJobRepository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
    assertNotEquals(JobStatus.COMPLETED, captor.getValue().getStatus());
    org.mockito.Mockito.verify(storyboardMapper, org.mockito.Mockito.never())
        .insertScene(any(SceneRow.class));
  }

  @Test
  void doesNotCompleteAnalysisWhenProviderPayloadCannotBeMaterialized() {
    UUID projectId = UuidV7.random();
    UUID chapterId = UuidV7.random();
    UUID revisionId = UuidV7.random();
    GenerationJob job =
        GenerationJob.createChapterAnalysis(
            projectId,
            UuidV7.random(),
            chapterId,
            revisionId,
            1L,
            "a".repeat(64),
            "Chapter text content",
            "vi",
            "key:analysis:invalid-payload",
            "IMAGE",
            "API");

    when(generationJobRepository.findByJobId(job.getJobId())).thenReturn(Optional.of(job));
    when(generationJobRepository.save(any(GenerationJob.class))).thenAnswer(i -> i.getArgument(0));
    when(chapterAnalysisProvider.analyze(any(ChapterAnalysisRequest.class)))
        .thenReturn(
            new ChapterAnalysisResult(
                "{\"characters\":[]}",
                new ChapterAnalysisUsage(100, 50, 20, 0, 150, 200),
                "gemini-3.8-flash",
                "test-hash"));

    dispatcher.dispatchJob(job.getJobId());

    ArgumentCaptor<GenerationJob> captor = ArgumentCaptor.forClass(GenerationJob.class);
    verify(generationJobRepository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
    assertNotEquals(JobStatus.COMPLETED, captor.getValue().getStatus());
    org.mockito.Mockito.verify(storyboardMapper, org.mockito.Mockito.never())
        .insertScene(any(SceneRow.class));
  }

  @Test
  void handlesNarrationGenerationSuccessfully() {
    UUID projectId = UuidV7.random();
    GenerationJob job =
        GenerationJob.create(projectId, JobType.NARRATION_GENERATE, ResourceClass.PROVIDER_BATCH);

    when(generationJobRepository.findByJobId(job.getJobId())).thenReturn(Optional.of(job));
    when(generationJobRepository.save(any(GenerationJob.class))).thenAnswer(i -> i.getArgument(0));

    dispatcher.dispatchJob(job.getJobId());

    ArgumentCaptor<GenerationJob> captor = ArgumentCaptor.forClass(GenerationJob.class);
    verify(generationJobRepository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
    GenerationJob finalState = captor.getValue();
    assertEquals(JobStatus.COMPLETED, finalState.getStatus());
    verify(executionPort).submitTask(any(ComputeTaskRequest.class));
  }

  @Test
  void keepsExecutionOutcomeUnknownWhenDispatchFailsWithoutEvidence() {
    UUID projectId = UuidV7.random();
    GenerationJob job =
        GenerationJob.create(projectId, JobType.CHAPTER_GENERATE, ResourceClass.PROVIDER_BATCH);

    when(generationJobRepository.findByJobId(job.getJobId())).thenReturn(Optional.of(job));
    when(generationJobRepository.save(any(GenerationJob.class))).thenAnswer(i -> i.getArgument(0));
    when(executionPort.submitTask(any(ComputeTaskRequest.class)))
        .thenThrow(new RuntimeException("Compute service offline"));

    dispatcher.dispatchJob(job.getJobId());

    ArgumentCaptor<GenerationJob> captor = ArgumentCaptor.forClass(GenerationJob.class);
    verify(generationJobRepository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
    GenerationJob finalState = captor.getValue();
    assertEquals(JobStatus.UNKNOWN, finalState.getStatus());
  }

  @Test
  void keepsJobUnknownWhenComputeOutcomeCannotBeConfirmed() {
    UUID projectId = UuidV7.random();
    GenerationJob job =
        GenerationJob.create(projectId, JobType.CHAPTER_GENERATE, ResourceClass.PROVIDER_BATCH);

    when(generationJobRepository.findByJobId(job.getJobId())).thenReturn(Optional.of(job));
    when(generationJobRepository.save(any(GenerationJob.class))).thenAnswer(i -> i.getArgument(0));
    when(executionPort.queryTask(any(UUID.class), any(UUID.class))).thenReturn(null);

    dispatcher.dispatchJob(job.getJobId());

    ArgumentCaptor<GenerationJob> captor = ArgumentCaptor.forClass(GenerationJob.class);
    verify(generationJobRepository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
    GenerationJob finalState = captor.getValue();
    assertEquals(JobStatus.UNKNOWN, finalState.getStatus());
    verify(executionPort).submitTask(any(ComputeTaskRequest.class));
  }
}
