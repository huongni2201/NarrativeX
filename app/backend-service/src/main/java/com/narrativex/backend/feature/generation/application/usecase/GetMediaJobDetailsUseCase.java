package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.api.response.MediaJobDetailsResponse;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.MediaGenerationItemRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GetMediaJobDetailsUseCase {
  private final GenerationJobRepository generationJobRepository;
  private final MediaGenerationItemRepository mediaGenerationItemRepository;

  @Transactional(readOnly = true)
  public MediaJobDetailsResponse execute(UUID jobId) {
    var job =
        generationJobRepository
            .findByJobId(jobId)
            .orElseThrow(() -> new ResourceNotFoundException("Media job not found"));
    return MediaJobDetailsResponse.from(
        job, mediaGenerationItemRepository.findByJobId(job.getId()));
  }
}
