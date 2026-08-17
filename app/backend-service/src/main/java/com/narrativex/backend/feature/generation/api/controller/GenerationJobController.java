package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.application.query.GetGenerationJobQuery;
import com.narrativex.backend.feature.generation.application.usecase.GetGenerationJobUseCase;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/jobs")
public class GenerationJobController {
    private final GetGenerationJobUseCase getGenerationJobUseCase;

    public GenerationJobController(GetGenerationJobUseCase getGenerationJobUseCase) {
        this.getGenerationJobUseCase = getGenerationJobUseCase;
    }

    @GetMapping("/{jobId}")
    public ResponseEntity<ApiResponse<JobResponse>> get(@PathVariable String jobId,
            @RequestHeader(name = "X-User-Id", required = false) String ownerId) {
        GetGenerationJobQuery query = new GetGenerationJobQuery(jobId, ownerId);
        return ResponseEntity.ok(getGenerationJobUseCase.execute(query));
    }
}
