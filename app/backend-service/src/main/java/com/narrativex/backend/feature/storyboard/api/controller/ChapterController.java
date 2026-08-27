package com.narrativex.backend.feature.storyboard.api.controller;

import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.storyboard.api.request.CreateChapterRequest;
import com.narrativex.backend.feature.storyboard.api.request.ImportChapterContentRequest;
import com.narrativex.backend.feature.storyboard.api.request.UpdateChapterRequest;
import com.narrativex.backend.feature.storyboard.api.response.ChapterContentImportResponse;
import com.narrativex.backend.feature.storyboard.api.response.ChapterResponse;
import com.narrativex.backend.feature.storyboard.api.response.ChapterSummaryResponse;
import com.narrativex.backend.feature.storyboard.api.response.ChapterWorkspaceResponse;
import com.narrativex.backend.feature.storyboard.application.command.CreateChapterWithStoryCommand;
import com.narrativex.backend.feature.storyboard.application.command.ImportChapterContentCommand;
import com.narrativex.backend.feature.storyboard.application.command.UpdateChapterCommand;
import com.narrativex.backend.feature.storyboard.application.usecase.BatchImportChaptersUseCase;
import com.narrativex.backend.feature.storyboard.application.usecase.CreateChapterWithStoryUseCase;
import com.narrativex.backend.feature.storyboard.application.usecase.DeleteChapterUseCase;
import com.narrativex.backend.feature.storyboard.application.usecase.GetChapterUseCase;
import com.narrativex.backend.feature.storyboard.application.usecase.GetChapterWorkspaceUseCase;
import com.narrativex.backend.feature.storyboard.application.usecase.ImportChapterContentUseCase;
import com.narrativex.backend.feature.storyboard.application.usecase.ListChaptersUseCase;
import com.narrativex.backend.feature.storyboard.application.usecase.UpdateChapterUseCase;
import jakarta.validation.Valid;
import java.io.IOException;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/projects/{projectId}/chapters")
public class ChapterController {
  private static final int MAX_WORKSPACE_BATCH_SIZE = 200;

  private final CreateChapterWithStoryUseCase createChapterWithStoryUseCase;
  private final BatchImportChaptersUseCase batchImportChaptersUseCase;
  private final GetChapterUseCase getChapterUseCase;
  private final GetChapterWorkspaceUseCase getChapterWorkspaceUseCase;
  private final ListChaptersUseCase listChaptersUseCase;
  private final UpdateChapterUseCase updateChapterUseCase;
  private final DeleteChapterUseCase deleteChapterUseCase;
  private final ImportChapterContentUseCase importChapterContentUseCase;

  @PostMapping
  public ResponseEntity<ApiResponse<ChapterResponse>> create(
      @PathVariable UUID projectId,
      @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
      @Valid @RequestBody CreateChapterRequest request) {
    log.info("API POST create chapter for projectId={}, storyVersionId={}", projectId, request.storyVersionId());
    ApiResponse<ChapterResponse> response =
        createChapterWithStoryUseCase.execute(
            new CreateChapterWithStoryCommand(
                projectId,
                request.storyVersionId(),
                request.orderIndex(),
                request.title(),
                request.sourceText(),
                idempotencyKey));
    ChapterResponse chapter = response.data();
    return ResponseEntity.status(HttpStatus.CREATED)
        .location(URI.create("/api/v1/projects/" + projectId + "/chapters/" + chapter.id()))
        .header(HttpHeaders.ETAG, quotedVersion(chapter.rowVersion()))
        .body(response);
  }

  @PostMapping(value = "/batch-import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ResponseEntity<ApiResponse<List<ChapterResponse>>> batchImport(
      @PathVariable UUID projectId,
      @RequestParam(required = false) UUID storyVersionId,
      @RequestParam("file") MultipartFile file)
      throws IOException {
    List<ChapterResponse> imported =
        batchImportChaptersUseCase.execute(
            projectId,
            storyVersionId,
            file.getOriginalFilename(),
            file.getContentType(),
            file.getBytes());
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ApiResponse.success("Chapters imported successfully", imported));
  }

  @GetMapping
  public ResponseEntity<ApiResponse<CursorPage<ChapterSummaryResponse>>> list(
      @PathVariable UUID projectId,
      @RequestParam UUID storyVersionId,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "50") int limit) {
    return ResponseEntity.ok(listChaptersUseCase.execute(projectId, storyVersionId, cursor, limit));
  }

  @GetMapping("/{chapterId}")
  public ResponseEntity<ApiResponse<ChapterResponse>> get(
      @PathVariable UUID projectId, @PathVariable UUID chapterId) {
    ApiResponse<ChapterResponse> response = getChapterUseCase.execute(projectId, chapterId);
    return ResponseEntity.ok()
        .header(HttpHeaders.ETAG, quotedVersion(response.data().rowVersion()))
        .body(response);
  }

  @GetMapping("/{chapterId}/workspace")
  public ResponseEntity<ApiResponse<ChapterWorkspaceResponse>> workspace(
      @PathVariable UUID projectId, @PathVariable UUID chapterId) {
    return ResponseEntity.ok(getChapterWorkspaceUseCase.execute(projectId, chapterId));
  }

  @PostMapping("/workspaces:batch")
  public ResponseEntity<ApiResponse<List<ChapterWorkspaceResponse>>> workspaces(
      @PathVariable UUID projectId, @RequestBody List<UUID> chapterIds) {
    if (chapterIds.size() > MAX_WORKSPACE_BATCH_SIZE) {
      throw new IllegalArgumentException(
          "Chapter workspace batch is limited to " + MAX_WORKSPACE_BATCH_SIZE + " chapters");
    }
    var workspaces =
        chapterIds.stream()
            .distinct()
            .map(chapterId -> getChapterWorkspaceUseCase.execute(projectId, chapterId).data())
            .toList();
    return ResponseEntity.ok(ApiResponse.success("Chapter workspaces retrieved", workspaces));
  }

  @PutMapping("/{chapterId}")
  public ResponseEntity<ApiResponse<ChapterResponse>> update(
      @PathVariable UUID projectId,
      @PathVariable UUID chapterId,
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

  @DeleteMapping("/{chapterId}")
  public ResponseEntity<ApiResponse<Void>> delete(
      @PathVariable UUID projectId, @PathVariable UUID chapterId) {
    deleteChapterUseCase.execute(projectId, chapterId);
    return ResponseEntity.ok(ApiResponse.success("Chapter deleted successfully"));
  }

  @PostMapping("/{chapterId}/content")
  public ResponseEntity<ApiResponse<ChapterContentImportResponse>> importContent(
      @PathVariable UUID projectId,
      @PathVariable UUID chapterId,
      @Valid @RequestBody ImportChapterContentRequest request) {
    return ResponseEntity.accepted()
        .body(
            importChapterContentUseCase.execute(
                new ImportChapterContentCommand(
                    projectId, chapterId, request.content(), request.title())));
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
      throw new IllegalArgumentException("If-Match must contain a non-negative row version", exception);
    }
  }

  private static String quotedVersion(long rowVersion) {
    return "\"" + rowVersion + "\"";
  }
}
