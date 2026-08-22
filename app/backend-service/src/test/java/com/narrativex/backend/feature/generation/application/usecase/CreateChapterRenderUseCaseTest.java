package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class CreateChapterRenderUseCaseTest {

  @Test
  void encodesRenderExecutionSpecInOperationType() {
    assertThat(CreateChapterRenderUseCase.renderOperationType("720p", "mp4"))
        .isEqualTo("CHAPTER_RENDER_720P_MP4");
    assertThat(CreateChapterRenderUseCase.renderOperationType("1080p", "mp4"))
        .isEqualTo("CHAPTER_RENDER_1080P_MP4");
  }
}
