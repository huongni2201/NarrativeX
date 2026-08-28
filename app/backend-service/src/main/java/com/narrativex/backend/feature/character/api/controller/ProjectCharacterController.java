package com.narrativex.backend.feature.character.api.controller;

import com.narrativex.backend.feature.character.api.request.AssignCharacterToProjectRequest;
import com.narrativex.backend.feature.character.api.request.PinCharacterVersionRequest;
import com.narrativex.backend.feature.character.api.response.ProjectCharacterAssignmentResponse;
import com.narrativex.backend.feature.character.api.response.ProjectCharacterDetailResponse;
import com.narrativex.backend.feature.character.api.response.ProjectCharacterSummaryResponse;
import com.narrativex.backend.feature.character.application.command.AssignCharacterToProjectCommand;
import com.narrativex.backend.feature.character.application.usecase.AssignCharacterToProjectUseCase;
import com.narrativex.backend.feature.character.application.usecase.ComposeCharacterIdentityPromptUseCase;
import com.narrativex.backend.feature.character.application.usecase.GetProjectCharacterDetailUseCase;
import com.narrativex.backend.feature.character.application.usecase.ListProjectCharactersUseCase;
import com.narrativex.backend.feature.character.application.usecase.PinCharacterVersionUseCase;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.common.response.ApiResponse;
import jakarta.validation.Valid;
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
@RequestMapping("/api/v1/projects/{projectId}/characters")
public class ProjectCharacterController {
  private final ListProjectCharactersUseCase listProjectCharactersUseCase;
  private final GetProjectCharacterDetailUseCase getProjectCharacterDetailUseCase;
  private final AssignCharacterToProjectUseCase assignCharacterToProjectUseCase;
  private final PinCharacterVersionUseCase pinCharacterVersionUseCase;
  private final ComposeCharacterIdentityPromptUseCase composeCharacterIdentityPromptUseCase;

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

  @PostMapping
  public ResponseEntity<ApiResponse<ProjectCharacterAssignmentResponse>> assign(
      @PathVariable UUID projectId, @Valid @RequestBody AssignCharacterToProjectRequest request) {
    var assignment =
        assignCharacterToProjectUseCase.execute(
            new AssignCharacterToProjectCommand(
                projectId,
                request.characterId(),
                request.role(),
                request.importance(),
                request.projectAliases(),
                request.storyMetadata(),
                request.groups(),
                request.pinnedCharacterVersionId()));
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(
            ApiResponse.success(
                "Character assigned",
                new ProjectCharacterAssignmentResponse(
                    assignment.getId(), assignment.getCharacterId(), assignment.getProjectId())));
  }

  @GetMapping("/{characterId}")
  public ResponseEntity<ApiResponse<ProjectCharacterDetailResponse>> detail(
      @PathVariable UUID projectId, @PathVariable UUID characterId) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Project character retrieved successfully", detailResponse(projectId, characterId)));
  }

  @PutMapping("/{characterId}/pinned-version")
  public ResponseEntity<ApiResponse<ProjectCharacterDetailResponse>> pinVersion(
      @PathVariable UUID projectId,
      @PathVariable UUID characterId,
      @Valid @RequestBody PinCharacterVersionRequest request) {
    pinCharacterVersionUseCase.execute(projectId, characterId, request.versionId());
    return ResponseEntity.ok(
        ApiResponse.success(
            "Character version pinned", detailResponse(projectId, characterId)));
  }

  private ProjectCharacterDetailResponse detailResponse(UUID projectId, UUID characterId) {
    var model = getProjectCharacterDetailUseCase.execute(projectId, characterId);
    String prompt =
        model.version() == null ? null : composeCharacterIdentityPromptUseCase.execute(model);
    return ProjectCharacterDetailResponse.from(model, prompt);
  }
}
