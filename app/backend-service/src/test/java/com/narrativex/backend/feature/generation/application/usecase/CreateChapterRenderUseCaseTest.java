package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.narrativex.backend.feature.generation.application.command.CreateChapterRenderCommand;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CreateChapterRenderUseCaseTest {

  @Test
  void encodesRenderExecutionSpecInOperationType() {
    assertThat(CreateChapterRenderUseCase.renderOperationType("720p", "mp4"))
        .isEqualTo("CHAPTER_RENDER_720P_MP4");
    assertThat(CreateChapterRenderUseCase.renderOperationType("1080p", "mp4"))
        .isEqualTo("CHAPTER_RENDER_1080P_MP4");
  }

  @Test
  void generatedIdempotencyKeyFitsDatabaseColumnAndIsDeterministic() {
    CreateChapterRenderCommand command = command(null);
    String sourceHash = "a".repeat(64);

    String first = CreateChapterRenderUseCase.renderIdempotencyKey(command, sourceHash);
    String second = CreateChapterRenderUseCase.renderIdempotencyKey(command, sourceHash);

    assertThat(first).isEqualTo(second);
    assertThat(first).startsWith("chapter-render:");
    assertThat(first).hasSize(79);
    assertThat(first.length()).isLessThanOrEqualTo(512);
  }

  @Test
  void generatedIdempotencyKeyChangesWhenImmutableRenderInputChanges() {
    CreateChapterRenderCommand command = command(null);

    String first = CreateChapterRenderUseCase.renderIdempotencyKey(command, "a".repeat(64));
    String second = CreateChapterRenderUseCase.renderIdempotencyKey(command, "b".repeat(64));

    assertThat(first).isNotEqualTo(second);
  }

  @Test
  void suppliedIdempotencyKeyIsTrimmedAndBoundedByDatabaseContract() {
    assertThat(CreateChapterRenderUseCase.renderIdempotencyKey(command("  retry-1  "), "a".repeat(64)))
        .isEqualTo("retry-1");

    String maximum = "x".repeat(512);
    assertThat(CreateChapterRenderUseCase.renderIdempotencyKey(command(maximum), "a".repeat(64)))
        .isEqualTo(maximum);

    assertThatThrownBy(
            () ->
                CreateChapterRenderUseCase.renderIdempotencyKey(
                    command("x".repeat(513)), "a".repeat(64)))
        .isInstanceOf(GenerationAdmissionDeniedException.class)
        .hasMessageContaining("512");
  }

  private static CreateChapterRenderCommand command(String idempotencyKey) {
    return new CreateChapterRenderCommand(
        UUID.fromString("018f0000-0000-7000-8000-000000000001"),
        UUID.fromString("018f0000-0000-7000-8000-000000000002"),
        "1080p",
        "mp4",
        UUID.fromString("018f0000-0000-7000-8000-000000000003"),
        12,
        new BigDecimal("1.00"),
        idempotencyKey);
  }
}
