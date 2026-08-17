package com.narrativex.backend.modules.generation.api;

import com.narrativex.backend.modules.generation.application.GenerationApplicationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/jobs")
public class GenerationJobController {

    private final GenerationApplicationService generationService;

    public GenerationJobController(GenerationApplicationService generationService) {
        this.generationService = generationService;
    }

    @GetMapping("/{jobId}")
    public JobResponse get(@PathVariable String jobId,
                           @RequestHeader(name = "X-User-Id", required = false) String ownerId) {
        return JobResponse.from(generationService.getJob(jobId, ownerId));
    }
}
