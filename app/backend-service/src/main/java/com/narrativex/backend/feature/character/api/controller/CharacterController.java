package com.narrativex.backend.feature.character.api.controller;

import com.narrativex.backend.feature.character.api.request.CreateCharacterRequest;
import com.narrativex.backend.feature.character.api.request.CreateCharacterVersionRequest;
import com.narrativex.backend.feature.character.api.request.SetCharacterVersionReferencesRequest;
import com.narrativex.backend.feature.character.api.response.CharacterSummaryResponse;
import com.narrativex.backend.feature.character.api.response.CharacterVersionReferenceResponse;
import com.narrativex.backend.feature.character.api.response.CharacterVersionResponse;
import com.narrativex.backend.feature.character.application.command.ChangeCharacterVersionStatusCommand;
import com.narrativex.backend.feature.character.application.command.CreateCharacterCommand;
import com.narrativex.backend.feature.character.application.command.CreateCharacterVersionCommand;
import com.narrativex.backend.feature.character.application.query.CharacterListQuery;
import com.narrativex.backend.feature.character.application.usecase.CountCharactersUseCase;
import com.narrativex.backend.feature.character.application.usecase.CreateCharacterUseCase;
import com.narrativex.backend.feature.character.application.usecase.CreateCharacterVersionUseCase;
import com.narrativex.backend.feature.character.application.usecase.GetCharacterUseCase;
import com.narrativex.backend.feature.character.application.usecase.GetCharacterVersionReferencesUseCase;
import com.narrativex.backend.feature.character.application.usecase.ListCharactersUseCase;
import com.narrativex.backend.feature.character.application.usecase.LockCharacterVersionUseCase;
import com.narrativex.backend.feature.character.application.usecase.SetCharacterVersionReferencesUseCase;
import com.narrativex.backend.feature.character.application.usecase.SetCharacterVersionReferencesUseCase.ReferenceInput;
import com.narrativex.backend.feature.character.application.usecase.SubmitCharacterVersionForReviewUseCase;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.common.response.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/characters")
public class CharacterController {
  private final ListCharactersUseCase listCharactersUseCase;
  private final GetCharacterUseCase getCharacterUseCase;
  private final CountCharactersUseCase countCharactersUseCase;
  private final CreateCharacterUseCase createCharacterUseCase;
  private final CreateCharacterVersionUseCase createCharacterVersionUseCase;
  private final SubmitCharacterVersionForReviewUseCase submitCharacterVersionForReviewUseCase;
  private final LockCharacterVersionUseCase lockCharacterVersionUseCase;
  private final GetCharacterVersionReferencesUseCase getCharacterVersionReferencesUseCase;
  private final SetCharacterVersionReferencesUseCase setCharacterVersionReferencesUseCase;

  @GetMapping("/count")
  public ResponseEntity<ApiResponse<Long>> count() {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Character count retrieved successfully", countCharactersUseCase.execute()));
  }

  @PostMapping
  public ResponseEntity<ApiResponse<CharacterSummaryResponse>> create(
      @Valid @RequestBody CreateCharacterRequest request) {
    var character =
        createCharacterUseCase.execute(
            new CreateCharacterCommand(
                request.workspaceId(), request.canonicalName(), request.aliases(), null));
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ApiResponse.success("Character created", CharacterSummaryResponse.from(character)));
  }

  @GetMapping("/{characterId}")
  public ResponseEntity<ApiResponse<CharacterSummaryResponse>> detail(
      @PathVariable UUID characterId) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Character retrieved successfully",
            CharacterSummaryResponse.from(getCharacterUseCase.execute(characterId))));
  }

  @PostMapping("/{characterId}/versions")
  public ResponseEntity<ApiResponse<CharacterVersionResponse>> createVersion(
      @PathVariable UUID characterId,
      @Valid @RequestBody CreateCharacterVersionRequest request) {
    var version =
        createCharacterVersionUseCase.execute(
            new CreateCharacterVersionCommand(characterId, request.bible(), request.visualPrompt()));
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ApiResponse.success("Character version created", CharacterVersionResponse.from(version)));
  }

  @PostMapping("/{characterId}/versions/{versionId}/review")
  public ResponseEntity<ApiResponse<CharacterVersionResponse>> reviewVersion(
      @PathVariable UUID characterId, @PathVariable UUID versionId) {
    var version =
        submitCharacterVersionForReviewUseCase.execute(
            new ChangeCharacterVersionStatusCommand(versionId, null));
    if (!version.getCharacterId().equals(characterId)) {
      throw new ResourceNotFoundException("Character version not found");
    }
    return ResponseEntity.ok(
        ApiResponse.success(
            "Character version submitted for review", CharacterVersionResponse.from(version)));
  }

  @PostMapping("/{characterId}/versions/{versionId}/lock")
  public ResponseEntity<ApiResponse<CharacterVersionResponse>> lockVersion(
      @PathVariable UUID characterId, @PathVariable UUID versionId) {
    var version =
        lockCharacterVersionUseCase.execute(new ChangeCharacterVersionStatusCommand(versionId, null));
    if (!version.getCharacterId().equals(characterId)) {
      throw new ResourceNotFoundException("Character version not found");
    }
    return ResponseEntity.ok(
        ApiResponse.success("Character version locked", CharacterVersionResponse.from(version)));
  }

  @GetMapping("/{characterId}/versions/{versionId}/references")
  public ResponseEntity<ApiResponse<List<CharacterVersionReferenceResponse>>> versionReferences(
      @PathVariable UUID characterId, @PathVariable UUID versionId) {
    var references = getCharacterVersionReferencesUseCase.execute(characterId, versionId);
    return ResponseEntity.ok(
        ApiResponse.success(
            "Character version references retrieved successfully",
            references.stream().map(CharacterVersionReferenceResponse::from).toList()));
  }

  @PutMapping("/{characterId}/versions/{versionId}/references")
  public ResponseEntity<ApiResponse<List<CharacterVersionReferenceResponse>>> setVersionReferences(
      @PathVariable UUID characterId,
      @PathVariable UUID versionId,
      @RequestBody SetCharacterVersionReferencesRequest request) {
    List<ReferenceInput> inputs =
        request.references() == null
            ? List.of()
            : request.references().stream()
                .map(value -> new ReferenceInput(value.assetId(), value.role(), value.priority()))
                .toList();
    var references = setCharacterVersionReferencesUseCase.execute(characterId, versionId, inputs);
    return ResponseEntity.ok(
        ApiResponse.success(
            "Character version references updated successfully",
            references.stream().map(CharacterVersionReferenceResponse::from).toList()));
  }

  @GetMapping
  public ResponseEntity<ApiResponse<CursorPage<CharacterSummaryResponse>>> list(
      @RequestParam(required = false) String cursor, @RequestParam(defaultValue = "20") int limit) {
    CursorPage<CharacterSummaryResponse> page =
        listCharactersUseCase
            .execute(new CharacterListQuery(cursor, limit))
            .map(CharacterSummaryResponse::from);
    return ResponseEntity.ok(ApiResponse.success("Characters retrieved successfully", page));
  }
}
