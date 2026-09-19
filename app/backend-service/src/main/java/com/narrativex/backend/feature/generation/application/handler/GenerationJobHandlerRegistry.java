package com.narrativex.backend.feature.generation.application.handler;

import com.narrativex.backend.feature.generation.domain.enums.JobType;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Registry holding handlers for all supported JobTypes.
 */
@Component
public class GenerationJobHandlerRegistry {
  private final Map<JobType, GenerationJobHandler> handlers = new EnumMap<>(JobType.class);

  public GenerationJobHandlerRegistry(List<GenerationJobHandler> handlerList) {
    if (handlerList != null) {
      for (GenerationJobHandler handler : handlerList) {
        handlers.put(handler.supportedType(), handler);
      }
    }
  }

  public Optional<GenerationJobHandler> findHandler(JobType jobType) {
    return Optional.ofNullable(handlers.get(jobType));
  }

  public GenerationJobHandler handlerFor(JobType jobType) {
    GenerationJobHandler handler = handlers.get(jobType);
    if (handler == null) {
      throw new IllegalArgumentException("No GenerationJobHandler registered for type: " + jobType);
    }
    return handler;
  }
}
