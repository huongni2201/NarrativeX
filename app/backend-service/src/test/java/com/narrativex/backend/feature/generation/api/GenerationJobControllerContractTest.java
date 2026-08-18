package com.narrativex.backend.feature.generation.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.controller.GenerationJobController;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.application.query.GetGenerationJobQuery;
import com.narrativex.backend.feature.generation.application.usecase.GetGenerationJobUseCase;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class GenerationJobControllerContractTest {
  private final GetGenerationJobUseCase useCase = mock(GetGenerationJobUseCase.class);
  private final GenerationJobController controller = new GenerationJobController(useCase);

  @Test
  void getMapsPathAndHeaderToQueryAndReturnsUseCaseEnvelope() {
    JobResponse job =
        new JobResponse("job-1", "STORY_ANALYZE", "RUNNING", 40, "ANALYZING", "PROJECT", 7L, null);
    when(useCase.execute(any(GetGenerationJobQuery.class)))
        .thenReturn(ApiResponse.success("Generation job retrieved successfully", job));

    var responseEntity = controller.get("job-1");

    assertEquals(HttpStatus.OK, responseEntity.getStatusCode());
    assertEquals("job-1", responseEntity.getBody().data().jobId());
    verify(useCase).execute(new GetGenerationJobQuery("job-1", null));
  }
}
