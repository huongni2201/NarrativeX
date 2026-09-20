package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

/** Registry holding ComputeResultFinalizer instances per JobType and production mode. */
@Component
public class ComputeResultFinalizerRegistry {
  private final List<ComputeResultFinalizer> finalizers;

  public ComputeResultFinalizerRegistry(List<ComputeResultFinalizer> finalizerList) {
    this.finalizers = finalizerList != null ? List.copyOf(finalizerList) : Collections.emptyList();
  }

  public Optional<ComputeResultFinalizer> findFinalizer(JobType jobType) {
    return findFinalizer(jobType, null);
  }

  public Optional<ComputeResultFinalizer> findFinalizer(
      JobType jobType, ProductionMode productionMode) {
    if (jobType == null) {
      return Optional.empty();
    }
    for (ComputeResultFinalizer finalizer : finalizers) {
      if (finalizer.supports(jobType, productionMode)) {
        return Optional.of(finalizer);
      }
    }
    for (ComputeResultFinalizer finalizer : finalizers) {
      if (finalizer.supportedType() == jobType) {
        return Optional.of(finalizer);
      }
    }
    return Optional.empty();
  }
}
