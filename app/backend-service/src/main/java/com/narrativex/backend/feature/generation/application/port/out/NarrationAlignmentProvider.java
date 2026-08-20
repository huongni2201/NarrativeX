package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.domain.value.NarrationDocument;
import com.narrativex.backend.feature.generation.domain.value.NarrationSetSnapshot;
import com.narrativex.backend.feature.generation.domain.value.NarrationTimeline;

/** Worker-owned alignment boundary. Java orchestrates; audio processing stays in the worker. */
public interface NarrationAlignmentProvider {
  NarrationTimeline align(NarrationDocument document, NarrationSetSnapshot narration);
}
