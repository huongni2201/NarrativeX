package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.application.port.out.MediaGenerationItemRepository;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ReviewMediaGenerationItemUseCase {
  private final CurrentUserId currentUserId;
  private final MediaGenerationItemRepository repository;

  @Transactional
  public void execute(UUID itemId, String decision, long rowVersion) {
    if (!repository.review(currentUserId.get(), itemId, rowVersion, decision)) {
      throw new GenerationAdmissionDeniedException(
          "ASSET_REVIEW_REQUIRED", "The item changed or is no longer awaiting review.");
    }
  }
}
