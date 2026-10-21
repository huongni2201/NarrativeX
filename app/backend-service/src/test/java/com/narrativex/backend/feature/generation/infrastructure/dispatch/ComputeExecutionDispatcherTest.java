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

import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.catalog.application.port.in.VoiceCatalogAccess;
import com.narrativex.backend.feature.common.domain.enums.VoiceReferenceScope;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.model.VoiceReferenceSelection;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisRequest;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisResult;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisUsage;
import com.narrativex.backend.feature.generation.application.model.compute.ArtifactReadAccessDto;
import com.narrativex.backend.feature.generation.application.model.compute.ArtifactWriteAccessDto;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeSubmissionReceipt;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeTaskRequest;
import com.narrativex.backend.feature.generation.application.model.compute.InputArtifactRefDto;
import com.narrativex.backend.feature.generation.application.model.compute.OutputArtifactTargetDto;
import com.narrativex.backend.feature.generation.application.model.compute.ProducedArtifactDto;
import com.narrativex.backend.feature.generation.application.port.out.ChapterAnalysisRunRepository;
import com.narrativex.backend.feature.generation.application.port.out.ComputeArtifactAccess;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.MediaGenerationItemRepository;
import com.narrativex.backend.feature.generation.application.port.out.MediaPlanRepository;
import com.narrativex.backend.feature.generation.application.port.out.MediaPlanRepository.FrozenBeatImageInput;
import com.narrativex.backend.feature.generation.application.port.out.NarrationRequestRepository;
import com.narrativex.backend.feature.generation.application.service.GenerationJobTransactionService;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.entity.ChapterAnalysisRun;
import com.narrativex.backend.feature.generation.domain.entity.MediaGenerationItem;
import com.narrativex.backend.feature.generation.domain.entity.NarrationRequest;
import com.narrativex.backend.feature.generation.domain.enums.ChapterAnalysisExecutionMode;
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
          + "\"start_unit\":0,\"visual_direction\":{"
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
  private ChapterAnalysisRunRepository analysisRunRepository;
  private NarrationRequestRepository narrationRequestRepository;
  private VoiceCatalogAccess voiceCatalogAccess;
  private MediaGenerationItemRepository mediaGenerationItemRepository;
  private MediaPlanRepository mediaPlanRepository;
  private Map<UUID, OutputArtifactTargetDto> targetsByTask;
  private Map<UUID, GenerationJob> jobsById;
  private ComputeExecutionDispatcher dispatcher;

  @BeforeEach
  void setUp() {
    generationJobRepository = mock(GenerationJobRepository.class);
    executionPort = mock(GenerationExecutionPort.class);
    storyboardMapper = mock(StoryboardMapper.class);
    chapterMapper = mock(ChapterMapper.class);
    artifactAccess = mock(ComputeArtifactAccess.class);
    mediaAssetRepository = mock(MediaAssetRepository.class);
    analysisRunRepository = mock(ChapterAnalysisRunRepository.class);
    narrationRequestRepository = mock(NarrationRequestRepository.class);
    voiceCatalogAccess = mock(VoiceCatalogAccess.class);
    mediaGenerationItemRepository = mock(MediaGenerationItemRepository.class);
    mediaPlanRepository = mock(MediaPlanRepository.class);
    targetsByTask = new HashMap<>();
    jobsById = new HashMap<>();

    when(generationJobRepository.findByJobId(any(UUID.class)))
        .thenAnswer(i -> Optional.ofNullable(jobsById.get(i.getArgument(0))));
    when(generationJobRepository.save(any(GenerationJob.class)))
        .thenAnswer(
            i -> {
              GenerationJob saved = i.getArgument(0);
              jobsById.put(saved.getJobId(), saved);
              return saved;
            });
    when(artifactAccess.readOutput(any(OutputArtifactTargetDto.class)))
        .thenReturn(VALID_ANALYSIS_JSON.getBytes());

    dispatcher =
        new ComputeExecutionDispatcher(
            generationJobRepository,
            executionPort,
            storyboardMapper,
            chapterMapper,
            artifactAccess,
            mediaAssetRepository,
            null,
            null,
            analysisRunRepository,
            narrationRequestRepository,
            voiceCatalogAccess,
            mediaGenerationItemRepository,
            mediaPlanRepository);

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
              return new ComputeSubmissionReceipt(
                  req.taskId(), req.attemptId(), "handle:" + req.taskId(), "ACCEPTED", 1L);
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
  void materializesAnalysisDeliveredByDesktop() {
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
                "API")
            .markRunning("ANALYZING_STORY", 10);

    jobsById.put(job.getJobId(), job);
    when(storyboardMapper.findCurrentScenes(chapterId)).thenReturn(List.of());
    when(storyboardMapper.insertScene(any(SceneRow.class))).thenReturn(UuidV7.random());
    when(storyboardMapper.insertVisualBeat(any(VisualBeatRow.class))).thenReturn(UuidV7.random());
    ChapterRow currentChapter = new ChapterRow();
    currentChapter.setSourceHash(sourceHash);
    currentChapter.setRowVersion(1L);
    when(chapterMapper.findById(chapterId)).thenReturn(currentChapter);
    when(chapterMapper.update(any(ChapterRow.class))).thenReturn(1);

    analysisHandler()
        .materializeAndComplete(
            job,
            new ChapterAnalysisRequest(
                projectId,
                chapterId,
                revisionId,
                "Chapter text content",
                "vi",
                "1.1",
                "1.1",
                null,
                null),
            new ChapterAnalysisResult(
                VALID_ANALYSIS_JSON,
                new ChapterAnalysisUsage(100, 50, 20, 0, 150, 200),
                "gemini-3.8-flash",
                "test-canon-hash"),
            provenance());

    ArgumentCaptor<GenerationJob> captor = ArgumentCaptor.forClass(GenerationJob.class);
    verify(generationJobRepository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
    GenerationJob finalState = captor.getValue();
    assertEquals(JobStatus.COMPLETED, finalState.getStatus());
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
    assertTrue(
        persistedBeat.getSourceAnchorJson().contains("\"sourceHash\":\"" + sourceHash + "\""));

    ArgumentCaptor<ChapterAnalysisRun> runCaptor =
        ArgumentCaptor.forClass(ChapterAnalysisRun.class);
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
    givenFrozenImageAttempt();

    jobsById.put(job.getJobId(), job);
    dispatcher.dispatchJob(job.getJobId());

    ArgumentCaptor<GenerationJob> captor = ArgumentCaptor.forClass(GenerationJob.class);
    verify(generationJobRepository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
    GenerationJob finalState = captor.getValue();
    assertEquals(JobStatus.SUBMITTED, finalState.getStatus());
    assertNotNull(finalState.getComputeAttemptId());
    assertNotNull(finalState.getComputeExecutionHandle());
    verify(executionPort).submitTask(any(ComputeTaskRequest.class));
  }

  @Test
  void neverRunsChapterAnalysisOnTheBackend() {
    UUID chapterId = UuidV7.random();
    GenerationJob job =
        GenerationJob.createChapterAnalysis(
            UuidV7.random(),
            UuidV7.random(),
            chapterId,
            UuidV7.random(),
            1L,
            "a".repeat(64),
            "Chapter text content",
            "vi",
            "key:analysis:desktop-only",
            "IMAGE",
            "API");

    jobsById.put(job.getJobId(), job);

    dispatcher.dispatchJob(job.getJobId());

    assertEquals(JobStatus.QUEUED, jobsById.get(job.getJobId()).getStatus());
    verify(executionPort, never()).submitTask(any(ComputeTaskRequest.class));
    verify(storyboardMapper, never()).insertScene(any(SceneRow.class));
  }

  @Test
  void doesNotCompleteAnalysisWhenDeliveredPayloadCannotBeMaterialized() {
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
                "API")
            .markRunning("ANALYZING_STORY", 10);

    jobsById.put(job.getJobId(), job);

    try {
      analysisHandler()
          .materializeAndComplete(
              job,
              new ChapterAnalysisRequest(
                  projectId,
                  chapterId,
                  revisionId,
                  "Chapter text content",
                  "vi",
                  "1.1",
                  "1.1",
                  null,
                  null),
              new ChapterAnalysisResult(
                  "{\"characters\":[]}",
                  new ChapterAnalysisUsage(100, 50, 20, 0, 150, 200),
                  "gemini-3.8-flash",
                  "test-hash"),
              provenance());
    } catch (RuntimeException expectedWhenPayloadIsRejected) {
      // The transaction rolls back; the caller reports the attempt as failed.
    }

    assertNotEquals(JobStatus.COMPLETED, jobsById.get(job.getJobId()).getStatus());
    verify(storyboardMapper, never()).insertScene(any(SceneRow.class));
  }

  private ChapterAnalysisJobHandler analysisHandler() {
    return new ChapterAnalysisJobHandler(
        generationJobRepository,
        new GenerationJobTransactionService(generationJobRepository),
        storyboardMapper,
        chapterMapper,
        null,
        null,
        analysisRunRepository);
  }

  private static ChapterAnalysisJobHandler.LocalProvenance provenance() {
    return new ChapterAnalysisJobHandler.LocalProvenance(
        UuidV7.random(),
        UuidV7.random(),
        "antigravity-cli/1",
        "conversation-1",
        ChapterAnalysisExecutionMode.ANTIGRAVITY_CLI);
  }

  @Test
  void handlesNarrationGenerationSuccessfully() {
    UUID projectId = UuidV7.random();
    GenerationJob job =
        GenerationJob.create(projectId, JobType.NARRATION_GENERATE, ResourceClass.PROVIDER_BATCH);
    stubNarrationVoice(
        projectId,
        "vieneu-preset-minh-quan-pro",
        null,
        voice("vieneu-preset-minh-quan-pro", "Minh Quân Pro", null));

    jobsById.put(job.getJobId(), job);
    dispatcher.dispatchJob(job.getJobId());

    ArgumentCaptor<GenerationJob> captor = ArgumentCaptor.forClass(GenerationJob.class);
    verify(generationJobRepository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
    GenerationJob finalState = captor.getValue();
    assertEquals(JobStatus.SUBMITTED, finalState.getStatus());
    assertNotNull(finalState.getComputeAttemptId());
    assertNotNull(finalState.getComputeExecutionHandle());
    verify(executionPort).submitTask(any(ComputeTaskRequest.class));
  }

  @Test
  void narrationSendsPresetVoiceNameToWorker() {
    UUID projectId = UuidV7.random();
    GenerationJob job =
        GenerationJob.create(projectId, JobType.NARRATION_GENERATE, ResourceClass.PROVIDER_BATCH);
    stubNarrationVoice(
        projectId,
        "vieneu-preset-minh-quan-pro",
        null,
        voice("vieneu-preset-minh-quan-pro", "Minh Quân Pro", null));

    jobsById.put(job.getJobId(), job);
    dispatcher.dispatchJob(job.getJobId());

    ComputeTaskRequest request = submittedRequest();
    assertEquals(
        Map.of("kind", "catalog", "value", "Minh Quân Pro"), request.inputs().get("voice"));
    assertTrue(request.artifacts().inputs().isEmpty());
  }

  @Test
  void narrationClonesFromCustomVoiceReference() {
    UUID projectId = UuidV7.random();
    UUID referenceAssetId = UuidV7.random();
    GenerationJob job =
        GenerationJob.create(projectId, JobType.NARRATION_GENERATE, ResourceClass.PROVIDER_BATCH);
    stubNarrationVoice(projectId, "custom-1", null, voice("custom-1", null, referenceAssetId));
    InputArtifactRefDto reference = inputArtifact(referenceAssetId);
    when(artifactAccess.createVoiceReferenceInput(referenceAssetId, "voice-reference"))
        .thenReturn(reference);

    jobsById.put(job.getJobId(), job);
    dispatcher.dispatchJob(job.getJobId());

    ComputeTaskRequest request = submittedRequest();
    assertEquals(
        Map.of("kind", "artifact", "value", "voice-reference"), request.inputs().get("voice"));
    assertEquals(List.of(reference), request.artifacts().inputs());
  }

  @Test
  void narrationRequestReferenceOverridesCustomVoiceReference() {
    UUID projectId = UuidV7.random();
    UUID customReferenceId = UuidV7.random();
    UUID projectAssetId = UuidV7.random();
    GenerationJob job =
        GenerationJob.create(projectId, JobType.NARRATION_GENERATE, ResourceClass.PROVIDER_BATCH);
    stubNarrationVoice(
        projectId,
        "custom-1",
        new VoiceReferenceSelection(VoiceReferenceScope.PROJECT, projectAssetId),
        voice("custom-1", null, customReferenceId));
    InputArtifactRefDto reference = inputArtifact(projectAssetId);
    when(artifactAccess.createInput(projectId, projectAssetId, "voice-reference"))
        .thenReturn(reference);

    jobsById.put(job.getJobId(), job);
    dispatcher.dispatchJob(job.getJobId());

    assertEquals(List.of(reference), submittedRequest().artifacts().inputs());
    verify(artifactAccess, never()).createVoiceReferenceInput(any(), any());
  }

  @Test
  void narrationFailsSubmissionWhenVoiceIsDisabled() {
    UUID projectId = UuidV7.random();
    GenerationJob job =
        GenerationJob.create(projectId, JobType.NARRATION_GENERATE, ResourceClass.PROVIDER_BATCH);
    stubNarrationVoice(projectId, "custom-gone", null, null);

    jobsById.put(job.getJobId(), job);
    dispatcher.dispatchJob(job.getJobId());

    verify(executionPort, never()).submitTask(any(ComputeTaskRequest.class));
    assertEquals(JobStatus.FAILED, jobsById.get(job.getJobId()).getStatus());
  }

  private void stubNarrationVoice(
      UUID projectId,
      String voiceId,
      VoiceReferenceSelection selection,
      VoiceCatalogAccess.VoiceCapabilities capabilities) {
    when(narrationRequestRepository.findByGenerationJobId(any()))
        .thenReturn(
            Optional.of(
                new NarrationRequest(
                    UuidV7.random(),
                    projectId,
                    UuidV7.random(),
                    1L,
                    "a".repeat(64),
                    "Xin chào",
                    voiceId,
                    "vi",
                    java.math.BigDecimal.ONE,
                    "sentence-v1",
                    "b".repeat(64),
                    selection)));
    when(voiceCatalogAccess.findVoice(voiceId)).thenReturn(Optional.ofNullable(capabilities));
  }

  private static VoiceCatalogAccess.VoiceCapabilities voice(
      String id, String providerVoice, UUID referenceAssetId) {
    return new VoiceCatalogAccess.VoiceCapabilities(
        id, "VIENEU", true, true, false, 48000, "LOCAL_RETRYABLE", providerVoice, referenceAssetId);
  }

  private static InputArtifactRefDto inputArtifact(UUID assetId) {
    return new InputArtifactRefDto(
        assetId,
        "voice-reference",
        "audio/wav",
        1024,
        "c".repeat(64),
        new ArtifactReadAccessDto(
            "GET", "https://example.test/" + assetId, Instant.now().plusSeconds(300), Map.of()));
  }

  private ComputeTaskRequest submittedRequest() {
    ArgumentCaptor<ComputeTaskRequest> captor = ArgumentCaptor.forClass(ComputeTaskRequest.class);
    verify(executionPort).submitTask(captor.capture());
    return captor.getValue();
  }

  @Test
  void keepsExecutionOutcomeUnknownWhenDispatchFailsWithoutEvidence() {
    UUID projectId = UuidV7.random();
    GenerationJob job =
        GenerationJob.create(projectId, JobType.CHAPTER_GENERATE, ResourceClass.PROVIDER_BATCH);
    givenFrozenImageAttempt();

    jobsById.put(job.getJobId(), job);
    when(executionPort.submitTask(any(ComputeTaskRequest.class)))
        .thenThrow(new RuntimeException("Compute service offline"));

    dispatcher.dispatchJob(job.getJobId());

    ArgumentCaptor<GenerationJob> captor = ArgumentCaptor.forClass(GenerationJob.class);
    verify(generationJobRepository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
    GenerationJob finalState = captor.getValue();
    assertEquals(JobStatus.UNKNOWN, finalState.getStatus());
  }

  @Test
  void ignoresNonQueuedJob() {
    UUID projectId = UuidV7.random();
    GenerationJob job =
        GenerationJob.create(projectId, JobType.CHAPTER_GENERATE, ResourceClass.PROVIDER_BATCH)
            .markRunning("GENERATING_MEDIA", 50);

    jobsById.put(job.getJobId(), job);
    dispatcher.dispatchJob(job.getJobId());

    verify(executionPort, never()).submitTask(any(ComputeTaskRequest.class));
  }

  /** A single-VisualBeat image job with its frozen plan prompt, as admission persists it. */
  private void givenFrozenImageAttempt() {
    UUID visualBeatId = UuidV7.random();
    when(mediaGenerationItemRepository.findByJobId(any()))
        .thenReturn(
            List.of(
                MediaGenerationItem.create(
                    UuidV7.random(),
                    UuidV7.random(),
                    visualBeatId,
                    "beat-" + visualBeatId,
                    1,
                    "a".repeat(64))));
    when(mediaPlanRepository.findFrozenBeatImageInput(any(), any()))
        .thenReturn(
            Optional.of(
                new FrozenBeatImageInput(
                    "a lighthouse at dusk",
                    "blurry, low quality",
                    "{\"aspectRatio\":\"16:9\"}")));
  }
}
