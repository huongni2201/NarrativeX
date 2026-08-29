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
    }
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
