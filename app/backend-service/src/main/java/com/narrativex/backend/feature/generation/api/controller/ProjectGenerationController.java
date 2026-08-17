package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.application.command.EnqueueStoryAnalysisCommand;
import com.narrativex.backend.feature.generation.application.usecase.EnqueueStoryAnalysisUseCase;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/projects")
public class ProjectGenerationController {
    private final EnqueueStoryAnalysisUseCase enqueueStoryAnalysisUseCase;

    public ProjectGenerationController(EnqueueStoryAnalysisUseCase enqueueStoryAnalysisUseCase) {
        this.enqueueStoryAnalysisUseCase = enqueueStoryAnalysisUseCase;
    }

    @PostMapping("/{projectId}/analysis-jobs")
    public ResponseEntity<ApiResponse<JobResponse>> analyze(
            @PathVariable Long projectId,
            @RequestHeader(name = "X-User-Id", required = false) String ownerId) {
        EnqueueStoryAnalysisCommand command = new EnqueueStoryAnalysisCommand(projectId, ownerId);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(enqueueStoryAnalysisUseCase.execute(command));
    }
}
