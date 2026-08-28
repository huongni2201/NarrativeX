package com.narrativex.backend.feature.generation.api.response;

import com.narrativex.backend.feature.generation.application.service.VisualPromptComposer.ComposedVisualPrompt;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Backend-owned final prompt and ordered references consumed by the Desktop Gemini Web adapter. */
public record VisualBeatGeminiContextResponse(
    UUID visualBeatId, String prompt, List<ReferenceItem> references) {

  public VisualBeatGeminiContextResponse {
    references = references == null ? List.of() : List.copyOf(references);
  }

  public static VisualBeatGeminiContextResponse from(
      UUID visualBeatId, ComposedVisualPrompt composedPrompt) {
    var references = new ArrayList<ReferenceItem>();
    var bindings = composedPrompt.referenceBindings();
    for (int index = 0; index < bindings.size(); index++) {
      var binding = bindings.get(index);
      references.add(
          new ReferenceItem(
              String.format("REF_%02d", index + 1),
              binding.assetId(),
              binding.characterId(),
              binding.canonicalName(),
              binding.beatRole(),
              binding.referenceRole(),
              binding.priority(),
              binding.contentType(),
              binding.sha256()));
    }
    return new VisualBeatGeminiContextResponse(visualBeatId, composedPrompt.prompt(), references);
  }

  public record ReferenceItem(
      String refLabel,
      UUID assetId,
      UUID characterId,
      String canonicalName,
      String beatRole,
      String referenceRole,
      int priority,
      String contentType,
      String sha256) {}
}
