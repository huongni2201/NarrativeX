package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.application.command.EnqueueStoryAnalysisCommand;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.OperationPlanRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.aggregate.OperationPlan;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import java.math.BigDecimal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EnqueueStoryAnalysisUseCase {
  private final GenerationJobRepository jobRepository;
  private final OperationPlanRepository operationPlanRepository;
  private final ProjectAccess projectAccess;
  private final CurrentUserId currentUserId;

  public EnqueueStoryAnalysisUseCase(
      GenerationJobRepository jobRepository,
      OperationPlanRepository operationPlanRepository,
      ProjectAccess projectAccess,
      CurrentUserId currentUserId) {
    this.jobRepository = jobRepository;
    this.operationPlanRepository = operationPlanRepository;
    this.projectAccess = projectAccess;
    this.currentUserId = currentUserId;
  }

  @Transactional
  public ApiResponse<JobResponse> execute(EnqueueStoryAnalysisCommand command) {
    String ownerId = currentUserId.get();
    var project = projectAccess.findOwnedProject(command.projectId(), ownerId);
    operationPlanRepository.save(
        OperationPlan.create(
            project.getId(), "STORY_ANALYZE", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO));
    GenerationJob job =
        jobRepository.save(
            GenerationJob.create(
                project.getId(),
                JobType.STORY_ANALYZE,
                ResourceClass.PROVIDER_INTERACTIVE,
                ownerId));
    return ApiResponse.success("Story analysis job queued", JobResponse.from(job));
  }
}
