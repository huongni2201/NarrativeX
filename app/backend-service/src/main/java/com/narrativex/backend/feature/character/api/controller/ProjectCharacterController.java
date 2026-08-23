package com.narrativex.backend.feature.character.api.controller;

import com.narrativex.backend.feature.character.api.response.ProjectCharacterDetailResponse;
import com.narrativex.backend.feature.character.api.response.ProjectCharacterSummaryResponse;
import com.narrativex.backend.feature.character.application.usecase.GetProjectCharacterDetailUseCase;
import com.narrativex.backend.feature.character.application.usecase.ListProjectCharactersUseCase;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.common.response.ApiResponse;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/projects/{projectId}/characters")
public class ProjectCharacterController {
  private final ListProjectCharactersUseCase listProjectCharactersUseCase;
  private final GetProjectCharacterDetailUseCase getProjectCharacterDetailUseCase;

  @GetMapping
  public ResponseEntity<ApiResponse<CursorPage<ProjectCharacterSummaryResponse>>> list(
      @PathVariable UUID projectId,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "20") int limit) {
    CursorPage<ProjectCharacterSummaryResponse> page =
        listProjectCharactersUseCase
            .execute(projectId, cursor, limit)
            .map(ProjectCharacterSummaryResponse::from);
    return ResponseEntity.ok(
        ApiResponse.success("Project characters retrieved successfully", page));
  }

  @GetMapping("/{characterId}")
  public ResponseEntity<ApiResponse<ProjectCharacterDetailResponse>> detail(
      @PathVariable UUID projectId, @PathVariable UUID characterId) {
    ProjectCharacterDetailResponse response =
        ProjectCharacterDetailResponse.from(
            getProjectCharacterDetailUseCase.execute(projectId, characterId));
    return ResponseEntity.ok(
        ApiResponse.success("Project character retrieved successfully", response));
  }
}
