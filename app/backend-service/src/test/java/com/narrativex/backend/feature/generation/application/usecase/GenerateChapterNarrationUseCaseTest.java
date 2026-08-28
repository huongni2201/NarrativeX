package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import org.junit.jupiter.api.Test;

class GenerateChapterNarrationUseCaseTest {
  @Test
  void onlyExplicitRegenerationCanReplaceCompletedNarration() {
    assertThat(GenerateChapterNarrationUseCase.canStartAnotherAttempt(JobStatus.COMPLETED, false))
        .isFalse();
    assertThat(GenerateChapterNarrationUseCase.canStartAnotherAttempt(JobStatus.COMPLETED, true))
        .isTrue();
    assertThat(GenerateChapterNarrationUseCase.canStartAnotherAttempt(JobStatus.FAILED, false))
        .isTrue();
    assertThat(GenerateChapterNarrationUseCase.canStartAnotherAttempt(JobStatus.CANCELED, false))
        .isTrue();
    assertThat(GenerateChapterNarrationUseCase.canStartAnotherAttempt(JobStatus.RUNNING, true))
        .isFalse();
  }
}
