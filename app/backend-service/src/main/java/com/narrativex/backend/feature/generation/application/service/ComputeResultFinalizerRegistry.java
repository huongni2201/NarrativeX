package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.domain.enums.JobType;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Registry holding ComputeResultFinalizer instances per JobType.
 */
@Component
public class ComputeResultFinalizerRegistry {
  private final Map<JobType, ComputeResultFinalizer> finalizers = new EnumMap<>(JobType.class);

  public ComputeResultFinalizerRegistry(List<ComputeResultFinalizer> finalizerList) {
    if (finalizerList != null) {
      for (ComputeResultFinalizer finalizer : finalizerList) {
        finalizers.put(finalizer.supportedType(), finalizer);
      }
    }
  }

  public Optional<ComputeResultFinalizer> findFinalizer(JobType jobType) {
    return Optional.ofNullable(finalizers.get(jobType));
  }
}
