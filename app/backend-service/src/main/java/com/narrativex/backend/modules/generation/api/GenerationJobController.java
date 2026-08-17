package com.narrativex.backend.modules.generation.api;

import com.narrativex.backend.modules.generation.application.command.GetGenerationJobQuery;
import com.narrativex.backend.modules.generation.application.usecase.GetGenerationJobUseCase;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/jobs")
public class GenerationJobController {

    private final GetGenerationJobUseCase getGenerationJobUseCase;

    public GenerationJobController(GetGenerationJobUseCase getGenerationJobUseCase) {
        this.getGenerationJobUseCase = getGenerationJobUseCase;
    }

    @GetMapping("/{jobId}")
    public JobResponse get(@PathVariable String jobId,
                           @RequestHeader(name = "X-User-Id", required = false) String ownerId) {
        return JobResponse.from(getGenerationJobUseCase.execute(new GetGenerationJobQuery(jobId, ownerId)));
    }
}
