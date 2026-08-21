package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.request.CreateChapterRenderRequest;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.application.command.CreateChapterRenderCommand;
import com.narrativex.backend.feature.generation.application.usecase.CreateChapterRenderUseCase;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/projects/{projectId}/chapters/{chapterId}")
public class RenderController {
  private final CreateChapterRenderUseCase createChapterRenderUseCase;

  @PostMapping("/render")
  public ResponseEntity<ApiResponse<JobResponse>> render(
      @PathVariable Long projectId,
      @PathVariable Long chapterId,
      @Valid @RequestBody CreateChapterRenderRequest request,
      @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
    var job =
        createChapterRenderUseCase.execute(
            new CreateChapterRenderCommand(projectId, chapterId, request.resolution(), request.format(), request.mediaPlanId(), request.mediaPlanRevision(), request.maxAuthorizedCost(), idempotencyKey));
    return ResponseEntity.accepted()
        .body(ApiResponse.success("Chapter render queued", JobResponse.from(job)));
  }
}
