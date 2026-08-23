package com.narrativex.backend.feature.character.api.controller;

import com.narrativex.backend.feature.character.api.response.CharacterSummaryResponse;
import com.narrativex.backend.feature.character.application.query.CharacterListQuery;
import com.narrativex.backend.feature.character.application.usecase.CountCharactersUseCase;
import com.narrativex.backend.feature.character.application.usecase.GetCharacterUseCase;
import com.narrativex.backend.feature.character.application.usecase.ListCharactersUseCase;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.common.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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

  @GetMapping("/count")
  public ResponseEntity<ApiResponse<Long>> count() {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Character count retrieved successfully", countCharactersUseCase.execute()));
  }

  @GetMapping("/{characterId}")
  public ResponseEntity<ApiResponse<CharacterSummaryResponse>> detail(
      @PathVariable Long characterId) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Character retrieved successfully",
            CharacterSummaryResponse.from(getCharacterUseCase.execute(characterId))));
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
