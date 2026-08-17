package com.narrativex.backend.modules.generation.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.narrativex.backend.modules.generation.application.usecase.GetGenerationJobUseCase;
import com.narrativex.backend.modules.generation.domain.model.GenerationJob;
import com.narrativex.backend.modules.generation.domain.model.JobStatus;
import com.narrativex.backend.modules.generation.domain.model.JobType;
import com.narrativex.backend.modules.generation.domain.model.ResourceClass;
import com.narrativex.backend.shared.api.ApiResponse;
import org.junit.jupiter.api.Test;

class GenerationJobControllerContractTest {

    private final GetGenerationJobUseCase useCase = mock(GetGenerationJobUseCase.class);
    private final GenerationJobController controller = new GenerationJobController(useCase);

    @Test
    void getReturnsSuccessEnvelope() {
        GenerationJob job = GenerationJob.rehydrate(9L, 0L, "job-1", 7L, JobType.STORY_ANALYZE,
            JobStatus.RUNNING, ResourceClass.PROVIDER_INTERACTIVE, 40, "ANALYZING", null, "owner", "owner");
        when(useCase.execute(any())).thenReturn(job);

        ApiResponse<JobResponse> response = controller.get("job-1", "owner");

        assertTrue(response.success());
        assertEquals("job-1", response.data().jobId());
        assertEquals("RUNNING", response.data().status());
    }
}
