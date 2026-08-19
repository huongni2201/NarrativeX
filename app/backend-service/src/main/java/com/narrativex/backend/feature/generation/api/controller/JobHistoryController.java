package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.response.JobHistoryResponse;
import com.narrativex.backend.feature.generation.application.usecase.ListJobHistoryUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/jobs/history")
public class JobHistoryController {
  private final ListJobHistoryUseCase listJobHistoryUseCase;

  @GetMapping
  public ResponseEntity<ApiResponse<JobHistoryResponse.Page>> list(
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "20") int limit) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Job history retrieved successfully",
            JobHistoryResponse.Page.from(listJobHistoryUseCase.execute(cursor, limit))));
  }
}
