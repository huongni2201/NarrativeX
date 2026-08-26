package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
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
  private final CurrentUserId currentUserId;
  private final ProjectAccess projectAccess;
  private final ChapterMediaHeadRepository chapterMediaHeadRepository;
  private final GenerationJobRepository generationJobRepository;

  @Transactional(readOnly = true)
  public CurrentMediaJobResponse execute(UUID projectId, UUID chapterId) {
    String userId = currentUserId.get();
    projectAccess.findOwnedProject(projectId, userId);

    var internalJobId = chapterMediaHeadRepository.findCurrentJobId(chapterId);
    if (internalJobId.isEmpty()) {
      return new CurrentMediaJobResponse(null);
    }

    var job =
        generationJobRepository
            .findByIdAndOwner(internalJobId.get(), userId)
            .orElseThrow(
                () ->
                    new IllegalStateException(
                        "Chapter media head points to a missing generation job"));
    if (!projectId.equals(job.getProjectId()) || !chapterId.equals(job.getChapterId())) {
      throw new IllegalStateException("Chapter media head points outside the requested scope");
    }
    return new CurrentMediaJobResponse(job.getJobId());
  }
}
