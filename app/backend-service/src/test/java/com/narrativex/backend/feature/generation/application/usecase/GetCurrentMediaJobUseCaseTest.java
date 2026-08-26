package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.application.port.out.ChapterMediaHeadRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class GetCurrentMediaJobUseCaseTest {
  private static final String OWNER_ID = "owner-1";
  private static final UUID PROJECT_ID = UUID.randomUUID();
  private static final UUID CHAPTER_ID = UUID.randomUUID();
  private static final UUID INTERNAL_JOB_ID = UUID.randomUUID();
  private static final UUID PUBLIC_JOB_ID = UUID.randomUUID();

  @Mock private CurrentUserId currentUserId;
  @Mock private ProjectAccess projectAccess;
  @Mock private ChapterMediaHeadRepository chapterMediaHeadRepository;
  @Mock private GenerationJobRepository generationJobRepository;
  @InjectMocks private GetCurrentMediaJobUseCase useCase;

  @Test
  void returnsNoCurrentJobWhenChapterHasNoMediaHead() {
    when(currentUserId.get()).thenReturn(OWNER_ID);
    when(projectAccess.findOwnedProject(PROJECT_ID, OWNER_ID)).thenReturn(mock(Project.class));
    when(chapterMediaHeadRepository.findCurrentJobId(CHAPTER_ID)).thenReturn(Optional.empty());

    var result = useCase.execute(PROJECT_ID, CHAPTER_ID);

    assertThat(result.jobId()).isNull();
    verifyNoInteractions(generationJobRepository);
  }

  @Test
  void resolvesInternalMediaHeadIdToPublicJobId() {
    GenerationJob job = mock(GenerationJob.class);
    when(currentUserId.get()).thenReturn(OWNER_ID);
    when(projectAccess.findOwnedProject(PROJECT_ID, OWNER_ID)).thenReturn(mock(Project.class));
    when(chapterMediaHeadRepository.findCurrentJobId(CHAPTER_ID))
        .thenReturn(Optional.of(INTERNAL_JOB_ID));
    when(generationJobRepository.findByIdAndOwner(INTERNAL_JOB_ID, OWNER_ID))
        .thenReturn(Optional.of(job));
    when(job.getProjectId()).thenReturn(PROJECT_ID);
    when(job.getChapterId()).thenReturn(CHAPTER_ID);
    when(job.getJobId()).thenReturn(PUBLIC_JOB_ID);

    var result = useCase.execute(PROJECT_ID, CHAPTER_ID);

    assertThat(result.jobId()).isEqualTo(PUBLIC_JOB_ID);
    verify(generationJobRepository).findByIdAndOwner(INTERNAL_JOB_ID, OWNER_ID);
    verify(generationJobRepository, never()).findByJobIdAndOwner(INTERNAL_JOB_ID, OWNER_ID);
  }
}
