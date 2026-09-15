package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeTaskRequest;
import com.narrativex.backend.feature.generation.application.model.compute.SubmitTaskResult;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.SceneRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.StoryboardMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.VisualBeatRow;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class ComputeExecutionDispatcherTest {

  private GenerationJobRepository generationJobRepository;
  private GenerationExecutionPort executionPort;
  private StoryboardMapper storyboardMapper;
  private ChapterMapper chapterMapper;
  private ComputeExecutionDispatcher dispatcher;

  @BeforeEach
  void setUp() {
    generationJobRepository = mock(GenerationJobRepository.class);
    executionPort = mock(GenerationExecutionPort.class);
    storyboardMapper = mock(StoryboardMapper.class);
    chapterMapper = mock(ChapterMapper.class);
    dispatcher =
        new ComputeExecutionDispatcher(
            generationJobRepository, executionPort, storyboardMapper, chapterMapper);

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
                    List.of(),
                    null,
                    null));
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

    dispatcher.dispatchJob(job.getJobId());

    ArgumentCaptor<GenerationJob> captor = ArgumentCaptor.forClass(GenerationJob.class);
    verify(generationJobRepository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
    GenerationJob finalState = captor.getValue();
    assertEquals(JobStatus.COMPLETED, finalState.getStatus());
    verify(executionPort).submitTask(any(ComputeTaskRequest.class));
    verify(storyboardMapper).insertScene(any(SceneRow.class));
    verify(storyboardMapper).insertVisualBeat(any(VisualBeatRow.class));
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
  void handlesExecutionFailureGracefully() {
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
    assertEquals(JobStatus.FAILED, finalState.getStatus());
  }
}
