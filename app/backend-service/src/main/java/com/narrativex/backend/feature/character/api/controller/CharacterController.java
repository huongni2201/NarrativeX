package com.narrativex.backend.feature.character.api.controller;

import com.narrativex.backend.feature.character.api.request.SetCharacterVersionReferencesRequest;
import com.narrativex.backend.feature.character.api.response.CharacterSummaryResponse;
import com.narrativex.backend.feature.character.api.response.CharacterVersionReferenceResponse;
import com.narrativex.backend.feature.character.application.query.CharacterListQuery;
import com.narrativex.backend.feature.character.application.usecase.CountCharactersUseCase;
import com.narrativex.backend.feature.character.application.usecase.GetCharacterUseCase;
import com.narrativex.backend.feature.character.application.usecase.GetCharacterVersionReferencesUseCase;
import com.narrativex.backend.feature.character.application.usecase.ListCharactersUseCase;
import com.narrativex.backend.feature.character.application.usecase.SetCharacterVersionReferencesUseCase;
import com.narrativex.backend.feature.character.application.usecase.SetCharacterVersionReferencesUseCase.ReferenceInput;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.common.response.ApiResponse;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
  private final GetCharacterVersionReferencesUseCase getCharacterVersionReferencesUseCase;
  private final SetCharacterVersionReferencesUseCase setCharacterVersionReferencesUseCase;

  @GetMapping("/count")
  public ResponseEntity<ApiResponse<Long>> count() {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Character count retrieved successfully", countCharactersUseCase.execute()));
  }

  @GetMapping("/{characterId}")
  public ResponseEntity<ApiResponse<CharacterSummaryResponse>> detail(
      @PathVariable UUID characterId) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Character retrieved successfully",
            CharacterSummaryResponse.from(getCharacterUseCase.execute(characterId))));
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
