package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import org.junit.jupiter.api.Test;

class CreateMediaJobUseCaseTest {

  @Test
  void normalizesIdempotencyKeyBeforePersistence() {
    assertThat(CreateMediaJobUseCase.requireIdempotencyKey("  media-request-123  "))
        .isEqualTo("media-request-123");
  }

  @Test
  void acceptsDatabaseMaximumIdempotencyKeyLength() {
    String value = "k".repeat(200);

    assertThat(CreateMediaJobUseCase.requireIdempotencyKey(value)).isEqualTo(value);
  }

  @Test
  void rejectsMissingIdempotencyKey() {
    assertThatThrownBy(() -> CreateMediaJobUseCase.requireIdempotencyKey(null))
        .isInstanceOf(GenerationAdmissionDeniedException.class);
    assertThatThrownBy(() -> CreateMediaJobUseCase.requireIdempotencyKey("   "))
        .isInstanceOf(GenerationAdmissionDeniedException.class);
  }

  @Test
  void rejectsIdempotencyKeyLongerThanDatabaseColumn() {
    assertThatThrownBy(() -> CreateMediaJobUseCase.requireIdempotencyKey("k".repeat(201)))
        .isInstanceOf(GenerationAdmissionDeniedException.class)
        .hasMessageContaining("200");
  }
}
