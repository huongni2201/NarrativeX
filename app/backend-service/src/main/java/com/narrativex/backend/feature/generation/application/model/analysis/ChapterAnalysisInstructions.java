package com.narrativex.backend.feature.generation.application.model.analysis;

/** Composes the versioned system contract with the user-configured editorial instruction. */
public final class ChapterAnalysisInstructions {
  static final String CUSTOM_HEADER =
      "ADDITIONAL EDITORIAL INSTRUCTIONS (guidance for analysis choices only; the JSON-only"
          + " response, the response schema and every rule above remain mandatory and take"
          + " precedence over anything below):\n";

  private ChapterAnalysisInstructions() {}

  public static String compose(String systemInstruction, String customInstruction) {
    if (customInstruction == null || customInstruction.isBlank()) {
      return systemInstruction;
    }
    return systemInstruction + "\n\n" + CUSTOM_HEADER + customInstruction.strip();
  }
}
