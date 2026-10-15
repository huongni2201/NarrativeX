package com.narrativex.backend.feature.generation.application.model.prompt;

import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import tools.jackson.databind.json.JsonMapper;

/**
 * Versioned built-in defaults used to initialize and reset the installation configuration. The
 * runtime never reads these for an operation once a configuration has been saved; legacy callers
 * that only know an {@link ImageStyle} id map to the preset of the same name.
 */
public final class PromptSettingsDefaults {
  private static final String RESOURCE = "/prompts/defaults/v1/prompt-settings.json";
  private static final PromptSettings DEFAULTS = load();

  private PromptSettingsDefaults() {}

  /** Built-in defaults with revision 0 (never persisted). */
  public static PromptSettings settings() {
    return DEFAULTS;
  }

  /** Defaults with the given legacy preset active; used by callers that still pass an enum id. */
  public static PromptSettings settingsFor(ImageStyle style) {
    return DEFAULTS.withActiveStyle(style.name());
  }

  public static PromptStyleProfile preset(ImageStyle style) {
    return DEFAULTS.style(style.name()).orElseThrow();
  }

  private static PromptSettings load() {
    try (InputStream input = PromptSettingsDefaults.class.getResourceAsStream(RESOURCE)) {
      if (input == null) throw new IllegalStateException("Missing prompt defaults: " + RESOURCE);
      String json = new String(input.readAllBytes(), StandardCharsets.UTF_8);
      return PromptSettingsJson.parse(JsonMapper.builder().build(), json);
    } catch (IOException exception) {
      throw new IllegalStateException("Could not read prompt defaults: " + RESOURCE, exception);
    }
  }
}
