package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;

/**
 * Strategy interface for finalizing compute outputs into persistent media assets and updating the
 * GenerationJob to COMPLETED state. Shared identically by both Callback and Scheduled
 * Reconciliation paths.
 */
public interface ComputeResultFinalizer {
  JobType supportedType();

  default boolean supports(JobType jobType, ProductionMode productionMode) {
    return supportedType() == jobType;
  }

  void finalizeResult(GenerationJob job, ComputeObservationDto observation);
}
