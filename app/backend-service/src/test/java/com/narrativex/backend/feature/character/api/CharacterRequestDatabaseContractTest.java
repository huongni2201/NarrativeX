package com.narrativex.backend.feature.character.api;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.feature.character.api.request.AssignCharacterToProjectRequest;
import com.narrativex.backend.feature.character.api.request.CreateCharacterRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CharacterRequestDatabaseContractTest {
  private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

  @Test
  void createCharacterRejectsValuesLongerThanDatabaseColumns() {
    CreateCharacterRequest request =
        new CreateCharacterRequest("w".repeat(129), "n".repeat(161), List.of());

    var violations = validator.validate(request);

    assertTrue(
        violations.stream()
            .anyMatch(violation -> violation.getPropertyPath().toString().equals("workspaceId")));
    assertTrue(
        violations.stream()
            .anyMatch(violation -> violation.getPropertyPath().toString().equals("canonicalName")));
  }

  @Test
  void projectAssignmentRejectsRoleLongerThanDatabaseColumn() {
    AssignCharacterToProjectRequest request =
        new AssignCharacterToProjectRequest(
            UUID.randomUUID(), "r".repeat(65), 0, List.of(), null, List.of(), null);

    var violations = validator.validate(request);

    assertTrue(
        violations.stream()
            .anyMatch(violation -> violation.getPropertyPath().toString().equals("role")));
  }
}
