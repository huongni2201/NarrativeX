package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeTaskRequest;
import com.narrativex.backend.feature.generation.application.model.compute.SubmitTaskResult;
import java.util.UUID;

public interface GenerationExecutionPort {
  /**
   * Submit an immutable execution task to the generation service.
   *
   * @param request the compute task request
   * @return the submission result
   */
  SubmitTaskResult submitTask(ComputeTaskRequest request);

  /**
   * Reconcile or poll the status of a previously submitted task attempt.
   *
   * @param taskId the compute task id
   * @param attemptId the attempt id
   * @return the compute observation, or empty if not found
   */
  ComputeObservationDto queryTask(UUID taskId, UUID attemptId);

  /**
   * Request cooperative cancellation of a running task attempt.
   *
   * @param taskId the compute task id
   * @param attemptId the attempt id
   */
  void cancelTask(UUID taskId, UUID attemptId);
}
