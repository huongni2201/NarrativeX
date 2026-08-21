package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.api.response.MediaJobDetailsResponse;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.MediaGenerationItemRepository;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GetMediaJobDetailsUseCase {
  private final CurrentUserId currentUserId;
  private final GenerationJobRepository generationJobRepository;
  private final MediaGenerationItemRepository mediaGenerationItemRepository;

  @Transactional(readOnly = true)
  public MediaJobDetailsResponse execute(String jobId) {
    String userId = currentUserId.get();
    var job = generationJobRepository.findByJobIdAndOwner(jobId, userId)
        .orElseThrow(() -> new ResourceNotFoundException("Media job not found"));
    return MediaJobDetailsResponse.from(job, mediaGenerationItemRepository.findByJobOwned(userId, job.getId()));
  }
}
