package com.narrativex.backend.feature.generation.application.port.out;

import java.util.UUID;

public interface VideoJobDispatcher {
  void dispatch(UUID jobId);
}
