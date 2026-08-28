package com.narrativex.backend.feature.storyboard.application.port.out;

import com.narrativex.backend.feature.storyboard.domain.entity.VisualBeat;
import java.util.UUID;

/** Provides the server-composed final prompt for a Visual Beat read model. */
public interface VisualBeatPromptProvider {
  String promptFor(UUID projectId, VisualBeat visualBeat);
}
