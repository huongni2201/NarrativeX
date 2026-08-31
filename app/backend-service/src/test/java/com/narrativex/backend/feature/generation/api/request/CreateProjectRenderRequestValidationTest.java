package com.narrativex.backend.feature.generation.api.request;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.Validation;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CreateProjectRenderRequestValidationTest {

  @Test
  void acceptsQhd1440pRenderResolution() {
    try (var factory = Validation.buildDefaultValidatorFactory()) {
      var validator = factory.getValidator();
      var request = new CreateProjectRenderRequest("1440p", "mp4", UUID.randomUUID(), List.of());

      assertThat(validator.validate(request)).isEmpty();
      assertThat(request.fps()).isEqualTo(30);
      assertThat(request.subtitlesEnabled()).isTrue();
    }
  }

  @Test
  void acceptsSmooth60FpsRender() {
    try (var factory = Validation.buildDefaultValidatorFactory()) {
      var validator = factory.getValidator();
      var request =
          new CreateProjectRenderRequest(
              "1080p", "mp4", UUID.randomUUID(), 60, Boolean.TRUE, List.of());

      assertThat(validator.validate(request)).isEmpty();
      assertThat(request.fps()).isEqualTo(60);
    }
  }

  @Test
  void rejectsUnsupportedFrameRate() {
    try (var factory = Validation.buildDefaultValidatorFactory()) {
      var validator = factory.getValidator();
      var request =
          new CreateProjectRenderRequest(
              "1080p", "mp4", UUID.randomUUID(), 45, Boolean.TRUE, List.of());

      assertThat(validator.validate(request)).isNotEmpty();
    }
  }

  @Test
  void preservesDisabledSubtitlePreference() {
    var request =
        new CreateProjectRenderRequest(
            "1080p", "mp4", UUID.randomUUID(), Boolean.FALSE, List.of());

    assertThat(request.subtitlesEnabled()).isFalse();
    assertThat(request.fps()).isEqualTo(30);
  }

  @Test
  void defaultsMissingSubtitlePreferenceToEnabled() {
    var request =
        new CreateProjectRenderRequest(
            "1080p", "mp4", UUID.randomUUID(), null, List.of());

    assertThat(request.subtitlesEnabled()).isTrue();
    assertThat(request.fps()).isEqualTo(30);
  }

  @Test
  void rejectsUnsupported2160pRenderResolution() {
    try (var factory = Validation.buildDefaultValidatorFactory()) {
      var validator = factory.getValidator();
      var request = new CreateProjectRenderRequest("2160p", "mp4", UUID.randomUUID(), List.of());

      assertThat(validator.validate(request))
          .extracting(violation -> violation.getPropertyPath().toString())
          .contains("resolution");
    }
  }
}
