package com.narrativex.backend.feature.storyboard.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.storyboard.api.request.CreateVisualBeatRequest;
import com.narrativex.backend.feature.storyboard.api.request.UpdateVisualBeatReviewStatusRequest;
import com.narrativex.backend.feature.storyboard.api.response.ChapterStoryboardResponse;
import com.narrativex.backend.feature.storyboard.api.response.VisualBeatResponse;
import com.narrativex.backend.feature.storyboard.application.usecase.CreateVisualBeatUseCase;
import com.narrativex.backend.feature.storyboard.application.usecase.GetChapterStoryboardUseCase;
import com.narrativex.backend.feature.storyboard.application.usecase.UpdateVisualBeatReviewStatusUseCase;
import jakarta.validation.Valid;
import java.net.URI;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/projects/{projectId}/chapters/{chapterId}")
public class StoryboardController {
  private final GetChapterStoryboardUseCase getChapterStoryboardUseCase;
  private final CreateVisualBeatUseCase createVisualBeatUseCase;
  private final UpdateVisualBeatReviewStatusUseCase updateVisualBeatReviewStatusUseCase;

  @GetMapping("/storyboard")
  public ResponseEntity<ApiResponse<ChapterStoryboardResponse>> getStoryboard(
      @PathVariable Long projectId, @PathVariable Long chapterId) {
    return ResponseEntity.ok(getChapterStoryboardUseCase.execute(projectId, chapterId));
  }

  @PostMapping("/scenes/{sceneId}/visual-beats")
  public ResponseEntity<ApiResponse<VisualBeatResponse>> createVisualBeat(
      @PathVariable Long projectId,
      @PathVariable Long chapterId,
      @PathVariable Long sceneId,
      @Valid @RequestBody CreateVisualBeatRequest request) {
    log.info(
        "API POST create visual beat for projectId={}, chapterId={}, sceneId={}",
        projectId,
        chapterId,
        sceneId);
    ApiResponse<VisualBeatResponse> response =
        createVisualBeatUseCase.execute(
            projectId, chapterId, sceneId, request.title(), request.visualIntent());
    return ResponseEntity.status(HttpStatus.CREATED)
        .location(
            URI.create(
                "/api/v1/projects/"
                    + projectId
                    + "/chapters/"
                    + chapterId
                    + "/scenes/"
                    + sceneId
                    + "/visual-beats/"
                    + response.data().id()))
        .header(HttpHeaders.ETAG, quotedVersion(response.data().rowVersion()))
        .body(response);
  }

  @PutMapping("/scenes/{sceneId}/visual-beats/{visualBeatId}/review-status")
  public ResponseEntity<ApiResponse<VisualBeatResponse>> updateReviewStatus(
      @PathVariable Long projectId,
      @PathVariable Long chapterId,
      @PathVariable Long sceneId,
      @PathVariable Long visualBeatId,
      @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch,
      @Valid @RequestBody UpdateVisualBeatReviewStatusRequest request) {
    log.info(
        "API PUT update review status to '{}' for visualBeatId={}, sceneId={}, chapterId={}, projectId={}",
        request.status(),
        visualBeatId,
        sceneId,
        chapterId,
        projectId);
    long expectedRowVersion = parseExpectedVersion(ifMatch);
    ApiResponse<VisualBeatResponse> response =
        updateVisualBeatReviewStatusUseCase.execute(
            projectId, chapterId, sceneId, visualBeatId, expectedRowVersion, request.status());
    return ResponseEntity.ok()
        .header(HttpHeaders.ETAG, quotedVersion(response.data().rowVersion()))
        .body(response);
  }

  private static long parseExpectedVersion(String value) {
    String normalized = value == null ? "" : value.trim();
    if (normalized.startsWith("W/")) {
      normalized = normalized.substring(2).trim();
    }
    if (normalized.startsWith("\"") && normalized.endsWith("\"") && normalized.length() >= 2) {
      normalized = normalized.substring(1, normalized.length() - 1);
    }
    try {
      long version = Long.parseLong(normalized);
      if (version < 0) {
        throw new NumberFormatException("negative version");
      }
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
