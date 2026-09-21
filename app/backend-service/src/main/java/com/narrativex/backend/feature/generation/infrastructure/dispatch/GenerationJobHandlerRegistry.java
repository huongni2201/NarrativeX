package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

/** Registry holding handlers for all supported JobTypes and production modes. */
@Component
public class GenerationJobHandlerRegistry {
  private final Map<JobType, GenerationJobHandler> defaultHandlers = new EnumMap<>(JobType.class);
  private VideoGenerationJobHandler videoJobHandler;

  public GenerationJobHandlerRegistry(List<GenerationJobHandler> handlerList) {
    if (handlerList != null) {
      for (GenerationJobHandler handler : handlerList) {
        if (handler instanceof VideoGenerationJobHandler vHandler) {
          this.videoJobHandler = vHandler;
        } else {
          defaultHandlers.put(handler.supportedType(), handler);
        }
      }
    }
  }

  public Optional<GenerationJobHandler> findHandler(GenerationJob job) {
    if (job == null) return Optional.empty();
    return findHandler(job.getType(), job.getProductionMode());
  }

  public Optional<GenerationJobHandler> findHandler(JobType jobType) {
    return findHandler(jobType, null);
  }

  public Optional<GenerationJobHandler> findHandler(
      JobType jobType, ProductionMode productionMode) {
    if (jobType == JobType.CHAPTER_GENERATE
        && productionMode == ProductionMode.VIDEO_FIRST
        && videoJobHandler != null) {
      return Optional.of(videoJobHandler);
    }
    return Optional.ofNullable(defaultHandlers.get(jobType));
  }

  public GenerationJobHandler handlerFor(JobType jobType) {
    return handlerFor(jobType, null);
  }

  public GenerationJobHandler handlerFor(JobType jobType, ProductionMode productionMode) {
    return findHandler(jobType, productionMode)
        .orElseThrow(
            () ->
                new IllegalArgumentException(
                    "No GenerationJobHandler registered for type: " + jobType));
  }
}
