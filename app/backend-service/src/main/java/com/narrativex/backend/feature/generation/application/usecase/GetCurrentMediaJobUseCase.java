package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.api.response.CurrentMediaJobResponse;
import com.narrativex.backend.feature.generation.application.port.out.ChapterMediaHeadRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GetCurrentMediaJobUseCase {
  private final ProjectAccess projectAccess;
  private final ChapterMediaHeadRepository chapterMediaHeadRepository;
  private final GenerationJobRepository generationJobRepository;

  @Transactional(readOnly = true)
  public CurrentMediaJobResponse execute(UUID projectId, UUID chapterId) {
    return new CurrentMediaJobResponse(findCurrentJobId(projectId, chapterId));
  }

  @Transactional(readOnly = true)
  public UUID findCurrentJobId(UUID projectId, UUID chapterId) {
    projectAccess.findProject(projectId);

    var internalJobId = chapterMediaHeadRepository.findCurrentJobId(chapterId);
    if (internalJobId.isEmpty()) {
      return null;
    }

    var job =
        generationJobRepository
            .findById(internalJobId.get())
            .orElseThrow(() -> new ResourceNotFoundException("Current media job not found"));
    if (!projectId.equals(job.getProjectId()) || !chapterId.equals(job.getChapterId())) {
      throw new ResourceNotFoundException("Current media job not found");
    }
    return job.getJobId();
  }
}
