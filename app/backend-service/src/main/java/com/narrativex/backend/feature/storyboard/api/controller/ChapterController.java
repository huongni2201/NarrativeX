package com.narrativex.backend.feature.storyboard.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.storyboard.api.request.CreateChapterRequest;
import com.narrativex.backend.feature.storyboard.api.request.UpdateChapterRequest;
import com.narrativex.backend.feature.storyboard.api.response.ChapterResponse;
import com.narrativex.backend.feature.storyboard.api.response.ChapterSummaryResponse;
import com.narrativex.backend.feature.storyboard.api.response.ChapterWorkspaceResponse;
import com.narrativex.backend.feature.storyboard.application.command.CreateChapterCommand;
import com.narrativex.backend.feature.storyboard.application.command.UpdateChapterCommand;
import com.narrativex.backend.feature.storyboard.application.usecase.CreateChapterUseCase;
import com.narrativex.backend.feature.storyboard.application.usecase.GetChapterUseCase;
import com.narrativex.backend.feature.storyboard.application.usecase.GetChapterWorkspaceUseCase;
import com.narrativex.backend.feature.storyboard.application.usecase.ListChaptersUseCase;
import com.narrativex.backend.feature.storyboard.application.usecase.UpdateChapterUseCase;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/projects/{projectId}/chapters")
public class ChapterController {
  private final CreateChapterUseCase createChapterUseCase;
  private final GetChapterUseCase getChapterUseCase;
  private final GetChapterWorkspaceUseCase getChapterWorkspaceUseCase;
  private final ListChaptersUseCase listChaptersUseCase;
  private final UpdateChapterUseCase updateChapterUseCase;

  @PostMapping
  public ResponseEntity<ApiResponse<ChapterResponse>> create(
      @PathVariable Long projectId, @Valid @RequestBody CreateChapterRequest request) {
    ApiResponse<ChapterResponse> response =
        createChapterUseCase.execute(
            new CreateChapterCommand(
                projectId,
                request.storyVersionId(),
                request.orderIndex(),
                request.title(),
                request.sourceText()));
    ChapterResponse chapter = response.data();
    return ResponseEntity.status(HttpStatus.CREATED)
        .location(URI.create("/api/v1/projects/" + projectId + "/chapters/" + chapter.id()))
        .header(HttpHeaders.ETAG, quotedVersion(chapter.rowVersion()))
        .body(response);
  }

  @GetMapping
  public ResponseEntity<ApiResponse<List<ChapterSummaryResponse>>> list(
      @PathVariable Long projectId, @RequestParam Long storyVersionId) {
    return ResponseEntity.ok(listChaptersUseCase.execute(projectId, storyVersionId));
  }

  @GetMapping("/{chapterId}")
  public ResponseEntity<ApiResponse<ChapterResponse>> get(
      @PathVariable Long projectId, @PathVariable Long chapterId) {
    ApiResponse<ChapterResponse> response = getChapterUseCase.execute(projectId, chapterId);
    return ResponseEntity.ok()
        .header(HttpHeaders.ETAG, quotedVersion(response.data().rowVersion()))
        .body(response);
  }

  @GetMapping("/{chapterId}/workspace")
  public ResponseEntity<ApiResponse<ChapterWorkspaceResponse>> workspace(
      @PathVariable Long projectId, @PathVariable Long chapterId) {
    return ResponseEntity.ok(getChapterWorkspaceUseCase.execute(projectId, chapterId));
  }

  @PutMapping("/{chapterId}")
  public ResponseEntity<ApiResponse<ChapterResponse>> update(
      @PathVariable Long projectId,
      @PathVariable Long chapterId,
      @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch,
      @Valid @RequestBody UpdateChapterRequest request) {
    long expectedRowVersion = parseExpectedVersion(ifMatch);
    ApiResponse<ChapterResponse> response =
        updateChapterUseCase.execute(
            new UpdateChapterCommand(
                projectId, chapterId, expectedRowVersion, request.title(), request.sourceText()));
    return ResponseEntity.ok()
        .header(HttpHeaders.ETAG, quotedVersion(response.data().rowVersion()))
        .body(response);
  }

  private static long parseExpectedVersion(String value) {
    String normalized = value == null ? "" : value.trim();
    if (normalized.startsWith("W/")) normalized = normalized.substring(2).trim();
    if (normalized.startsWith("\"") && normalized.endsWith("\"") && normalized.length() >= 2) {
      normalized = normalized.substring(1, normalized.length() - 1);
    }
    try {
      long version = Long.parseLong(normalized);
      if (version < 0) throw new NumberFormatException("negative version");
      return version;
    } catch (NumberFormatException exception) {
      throw new IllegalArgumentException(
          "If-Match must contain a non-negative row version", exception);
    }
  }

  private static String quotedVersion(long rowVersion) {
    return "\"" + rowVersion + "\"";
  }
}
