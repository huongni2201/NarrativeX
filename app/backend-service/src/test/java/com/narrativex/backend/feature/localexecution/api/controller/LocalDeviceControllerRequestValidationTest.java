package com.narrativex.backend.feature.localexecution.api.controller;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.util.List;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class LocalDeviceControllerRequestValidationTest {
  private static jakarta.validation.ValidatorFactory validatorFactory;
  private static Validator validator;

  @BeforeAll
  static void setUpValidator() {
    validatorFactory = Validation.buildDefaultValidatorFactory();
    validator = validatorFactory.getValidator();
  }

  @AfterAll
  static void closeValidator() {
    validatorFactory.close();
  }

  @Test
  void pairRequestRejectsValuesThatExceedPersistenceLimits() {
    var request =
        new LocalDeviceController.PairDeviceRequest(
            "pairing-code",
            "n".repeat(161),
            "p".repeat(81),
            "v".repeat(65),
            List.of("c".repeat(65)));

    var violations = validator.validate(request);

    assertThat(violations)
        .extracting(violation -> violation.getPropertyPath().toString())
        .contains("name", "platform", "agentVersion", "capabilities[0].<list element>");
  }

  @Test
  void heartbeatRejectsOversizedVersionAndCapability() {
    var request =
        new LocalDeviceController.HeartbeatRequest(
            "v".repeat(65), List.of("c".repeat(65)));

    var violations = validator.validate(request);

    assertThat(violations)
        .extracting(violation -> violation.getPropertyPath().toString())
        .contains("agentVersion", "capabilities[0].<list element>");
  }

  @Test
  void validRequestsRespectDatabaseColumnLimits() {
    var pairRequest =
        new LocalDeviceController.PairDeviceRequest(
            "pairing-code", "Desktop", "windows", "1.0.0", List.of("GEMINI_WEB"));
    var heartbeatRequest =
        new LocalDeviceController.HeartbeatRequest("1.0.0", List.of("GEMINI_WEB"));

    assertThat(validator.validate(pairRequest)).isEmpty();
    assertThat(validator.validate(heartbeatRequest)).isEmpty();
  }
}
