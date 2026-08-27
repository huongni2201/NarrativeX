package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.generation.application.command.CreateProjectRenderCommand;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Applies Auto Edit media decisions and creates the immutable project render snapshot atomically.
 * If render admission, quota reservation or snapshot creation fails, media edits are rolled back.
 */
@Service
@RequiredArgsConstructor
public class CreateAutoEditedProjectRenderUseCase {
  private final UpdateProductionBeatMediaUseCase updateProductionBeatMediaUseCase;
  private final CreateProjectRenderUseCase createProjectRenderUseCase;

  @Transactional
  public GenerationJob execute(CreateProjectRenderCommand command) {
    updateProductionBeatMediaUseCase.applyRenderOverrides(
        command.projectId(), command.beatOverrides());
    return createProjectRenderUseCase.execute(command);
  }
}
