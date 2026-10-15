package com.narrativex.backend.feature.generation.application.model.prompt;

import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Installation-wide prompt configuration. One active style applies to every Project; operations
 * resolve it once at admission and freeze {@link #provenance()} plus the compiled prompts.
 *
 * <p>Revision is the persistence version used for compare-and-set; {@code 0} marks a configuration
 * that was never persisted (built-in defaults or an unsaved draft).
 */
public record PromptSettings(
    int formatVersion,
    long revision,
    String activeStyleId,
    List<PromptStyleProfile> styles,
    PromptInstructions instructions,
    String videoNegativePrompt) {
  public static final int FORMAT_VERSION = 1;
  public static final int MAX_STYLES = 32;
  public static final int MAX_BLOCK_BYTES = 32 * 1024;
  public static final int MAX_TOTAL_BYTES = 512 * 1024;

  public PromptSettings {
    if (formatVersion != FORMAT_VERSION) {
      throw new DomainValidationException("formatVersion: unsupported, expected " + FORMAT_VERSION);
    }
    if (revision < 0) {
      throw new DomainValidationException("revision: must not be negative");
    }
    if (styles == null || styles.isEmpty()) {
      throw new DomainValidationException("styles: at least one style is required");
    }
    if (styles.size() > MAX_STYLES) {
      throw new DomainValidationException("styles: at most " + MAX_STYLES + " styles are allowed");
    }
    styles = List.copyOf(styles);
    Set<String> ids = new HashSet<>();
    for (PromptStyleProfile style : styles) {
      if (!ids.add(style.id())) {
        throw new DomainValidationException("styles: duplicate id " + style.id());
      }
    }
    if (activeStyleId == null || !ids.contains(activeStyleId)) {
      throw new DomainValidationException("activeStyleId: must reference an existing style");
    }
    if (instructions == null) {
      throw new DomainValidationException("instructions: is required");
    }
    videoNegativePrompt =
        PromptText.optional("videoNegativePrompt", videoNegativePrompt, MAX_BLOCK_BYTES);
    long total =
        PromptText.utf8Bytes(videoNegativePrompt)
            + instructions.utf8Bytes()
            + styles.stream().mapToLong(PromptStyleProfile::utf8Bytes).sum();
    if (total > MAX_TOTAL_BYTES) {
      throw new DomainValidationException(
          "settings: exceeds " + MAX_TOTAL_BYTES + " bytes (UTF-8) in total");
    }
  }

  public PromptStyleProfile activeStyle() {
    return style(activeStyleId).orElseThrow();
  }

  public Optional<PromptStyleProfile> style(String id) {
    return styles.stream().filter(style -> style.id().equals(id)).findFirst();
  }

  public PromptSettings withRevision(long newRevision) {
    return new PromptSettings(
        formatVersion, newRevision, activeStyleId, styles, instructions, videoNegativePrompt);
  }

  public PromptSettings withActiveStyle(String styleId) {
    return new PromptSettings(
        formatVersion, revision, styleId, styles, instructions, videoNegativePrompt);
  }

  /** Hash of the whole configuration, excluding the revision. */
  public String semanticHash() {
    StringBuilder canonical = new StringBuilder("prompt-settings/v").append(formatVersion);
    append(canonical, "activeStyleId", activeStyleId);
    append(canonical, "styles", Integer.toString(styles.size()));
    styles.forEach(style -> appendStyle(canonical, style));
    appendInstructions(canonical);
    return sha256(canonical.toString());
  }

  /** Hash of the content that actually shapes prompts: active style, instructions, negatives. */
  public String effectiveHash() {
    StringBuilder canonical = new StringBuilder("prompt-effective/v").append(formatVersion);
    appendStyle(canonical, activeStyle());
    appendInstructions(canonical);
    return sha256(canonical.toString());
  }

  public PromptSettingsProvenance provenance() {
    return new PromptSettingsProvenance(revision, activeStyleId, effectiveHash());
  }

  private void appendInstructions(StringBuilder canonical) {
    append(canonical, "chapterAnalysis", instructions.chapterAnalysis());
    append(canonical, "characterReference", instructions.characterReference());
    append(canonical, "storyboard", instructions.storyboard());
    append(canonical, "video", instructions.video());
    append(canonical, "videoNegativePrompt", videoNegativePrompt);
  }

  private static void appendStyle(StringBuilder canonical, PromptStyleProfile style) {
    append(canonical, "style.id", style.id());
    append(canonical, "style.name", style.name());
    append(canonical, "style.positivePrompt", style.positivePrompt());
    append(canonical, "style.negativePrompt", style.negativePrompt());
    append(canonical, "style.characterRenderingPrompt", style.characterRenderingPrompt());
  }

  /** Length-prefixed fields keep the canonical form unambiguous without a JSON dependency. */
  private static void append(StringBuilder canonical, String label, String value) {
    canonical
        .append('\n')
        .append(label)
        .append(':')
        .append(PromptText.utf8Bytes(value))
        .append(':')
        .append(value);
  }

  static String sha256(String value) {
    try {
      byte[] hash =
          MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(hash);
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is unavailable", exception);
    }
  }
}
