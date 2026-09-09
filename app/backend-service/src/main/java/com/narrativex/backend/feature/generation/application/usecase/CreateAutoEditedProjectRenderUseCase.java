package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.generation.application.command.CreateProjectRenderCommand;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Applies validated Auto Edit media changes and creates the immutable render snapshot in one
 * transaction. Idempotency/replay is resolved by CreateProjectRenderUseCase before this mutation is
 * invoked, so a stale retry can never write old trim/fit values back into the live project.
 */
@Service
@RequiredArgsConstructor
public class CreateAutoEditedProjectRenderUseCase {
  private final UpdateProductionBeatMediaUseCase updateProductionBeatMediaUseCase;
  private final CreateProjectRenderUseCase createProjectRenderUseCase;

  @Transactional
  public GenerationJob execute(CreateProjectRenderCommand command) {
    return createProjectRenderUseCase.executeWithPreCreateMutation(
        command,
        () ->
            updateProductionBeatMediaUseCase.applyRenderOverrides(
                command.projectId(), command.beatOverrides()));
  }
}
