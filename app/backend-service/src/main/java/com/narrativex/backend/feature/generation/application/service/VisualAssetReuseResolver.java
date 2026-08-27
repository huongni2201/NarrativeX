package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource.BeatSnapshot;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource.SceneSnapshot;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/** Deterministic reuse policy that keeps long-form image cost below visual-beat density. */
public final class VisualAssetReuseResolver {
  public static final String GENERATE_NEW = "GENERATE_NEW";
  public static final String REUSE_APPROVED = "REUSE_APPROVED";
  public static final String REFRAME_DERIVED = "REFRAME_DERIVED";

  private static final long MINUTE_MS = 60_000L;
  private static final Pattern TOKEN_SPLIT = Pattern.compile("[^\\p{L}\\p{N}]+");
  private static final Set<String> STOP_WORDS =
      Set.of(
          "the",
          "and",
          "with",
          "from",
          "into",
          "that",
          "this",
          "while",
          "camera",
          "shot",
          "composition",
          "lighting",
          "continuity",
          "image",
          "scene",
          "character",
          "một",
          "của",
          "và",
          "với",
          "trong",
          "đang",
          "được",
          "cho",
          "cùng",
          "ảnh",
          "cảnh",
          "khung",
          "hình",
          "ánh",
          "sáng",
          "nhân",
          "vật");

  private VisualAssetReuseResolver() {}

  public static Map<UUID, Decision> plan(
      List<SceneSnapshot> scenes, String imageProvider, String requestedStrategy) {
    String provider = normalizeProvider(imageProvider);
    String strategy = normalizeStrategy(provider, requestedStrategy);

    if (GENERATE_NEW.equals(strategy)) {
      return generateAll(scenes);
    }

    Map<UUID, Decision> automatic = plan(scenes);
    Map<UUID, Decision> constrained = new LinkedHashMap<>();
    for (SceneSnapshot scene : scenes) {
      for (BeatSnapshot beat : scene.beats()) {
        Decision decision = automatic.getOrDefault(beat.visualBeatId(), Decision.generate());
        boolean allowed = strategy.equals(decision.assetStrategy());
        constrained.put(beat.visualBeatId(), allowed ? decision : Decision.generate());
      }
    }
    return Map.copyOf(constrained);
  }

  public static String normalizeStrategy(String imageProvider, String requestedStrategy) {
    String provider = normalizeProvider(imageProvider);
    if ("GEMINI_WEB".equals(provider)) {
      if (requestedStrategy != null
          && !requestedStrategy.isBlank()
          && !GENERATE_NEW.equals(requestedStrategy)) {
        throw new IllegalArgumentException("Web image generation only supports GENERATE_NEW.");
      }
      return GENERATE_NEW;
    }
    if (requestedStrategy == null || requestedStrategy.isBlank()) {
      return GENERATE_NEW;
    }
    if (!GENERATE_NEW.equals(requestedStrategy)
        && !REUSE_APPROVED.equals(requestedStrategy)
        && !REFRAME_DERIVED.equals(requestedStrategy)) {
      throw new IllegalArgumentException("Unsupported image generation strategy: " + requestedStrategy);
    }
    return requestedStrategy;
  }

  public static int countGenerated(
      List<SceneSnapshot> scenes, String imageProvider, String requestedStrategy) {
    return (int)
        plan(scenes, imageProvider, requestedStrategy).values().stream()
            .filter(decision -> GENERATE_NEW.equals(decision.assetStrategy()))
            .count();
  }

  /**
   * Build one stable decision map so cost estimation and executable MediaPlan use identical reuse
   * choices. Reuse pressure is soft: it only relaxes similarity thresholds inside the same scene; a
   * materially different beat still generates a new image even when the budget is exceeded.
   */
  public static Map<UUID, Decision> plan(List<SceneSnapshot> scenes) {
    double targetGenerationRatio = targetGenerationRatio(scenes);
    Map<UUID, Decision> decisions = new LinkedHashMap<>();
    int processed = 0;
    int generated = 0;

    for (SceneSnapshot scene : scenes) {
      BeatSnapshot generatedAnchor = null;
      for (BeatSnapshot beat : scene.beats()) {
        boolean reusePressure =
            processed >= 4 && generated / (double) Math.max(1, processed) > targetGenerationRatio;
        Decision decision = resolve(generatedAnchor, beat, reusePressure);
        decisions.put(beat.visualBeatId(), decision);
        processed++;
        if (GENERATE_NEW.equals(decision.assetStrategy())) {
          generated++;
          generatedAnchor = beat;
        }
      }
    }
    return Map.copyOf(decisions);
  }

  public static Decision resolve(BeatSnapshot generatedAnchor, BeatSnapshot candidate) {
    return resolve(generatedAnchor, candidate, false);
  }

  private static Decision resolve(
      BeatSnapshot generatedAnchor, BeatSnapshot candidate, boolean reusePressure) {
    if (generatedAnchor == null) {
      return Decision.generate();
    }

    String anchorIntent = normalize(generatedAnchor.visualIntent());
    String candidateIntent = normalize(candidate.visualIntent());
    boolean sameAngle = generatedAnchor.cameraAngle().equals(candidate.cameraAngle());

    if (anchorIntent.equals(candidateIntent)) {
      return sameAngle
          ? new Decision(REUSE_APPROVED, generatedAnchor.visualBeatId())
          : new Decision(REFRAME_DERIVED, generatedAnchor.visualBeatId());
    }

    Set<String> anchorTokens = significantTokens(anchorIntent);
    Set<String> candidateTokens = significantTokens(candidateIntent);
    if (anchorTokens.size() < 6 || candidateTokens.size() < 6) {
      return Decision.generate();
    }

    Set<String> sharedTokens = new HashSet<>(anchorTokens);
    sharedTokens.retainAll(candidateTokens);
    int shared = sharedTokens.size();
    double containment =
        shared / (double) Math.max(1, Math.min(anchorTokens.size(), candidateTokens.size()));
    double union = anchorTokens.size() + candidateTokens.size() - shared;
    double jaccard = shared / Math.max(1.0d, union);

    if (sameAngle && shared >= 10 && containment >= 0.86d) {
      return new Decision(REUSE_APPROVED, generatedAnchor.visualBeatId());
    }
    if (!sameAngle && shared >= 10 && containment >= 0.78d) {
      return new Decision(REFRAME_DERIVED, generatedAnchor.visualBeatId());
    }

    if (reusePressure && shared >= 6 && jaccard >= 0.34d) {
      if (sameAngle && containment >= 0.56d) {
        return new Decision(REUSE_APPROVED, generatedAnchor.visualBeatId());
      }
      if (!sameAngle && containment >= 0.52d) {
        return new Decision(REFRAME_DERIVED, generatedAnchor.visualBeatId());
      }
    }
    return Decision.generate();
  }

  public static int countGenerated(List<SceneSnapshot> scenes) {
    return (int)
        plan(scenes).values().stream()
            .filter(decision -> GENERATE_NEW.equals(decision.assetStrategy()))
            .count();
  }

  static double targetGenerationRatio(List<SceneSnapshot> scenes) {
    int totalBeats = scenes.stream().mapToInt(scene -> scene.beats().size()).sum();
    long estimatedDurationMs = estimateDurationMs(scenes);
    if (estimatedDurationMs >= 45 * MINUTE_MS || totalBeats >= 250) {
      return 0.50d;
    }
    if (estimatedDurationMs >= 30 * MINUTE_MS || totalBeats >= 180) {
      return 0.55d;
    }
    if (estimatedDurationMs >= 10 * MINUTE_MS || totalBeats >= 80) {
      return 0.58d;
    }
    return 0.60d;
  }

  private static Map<UUID, Decision> generateAll(List<SceneSnapshot> scenes) {
    Map<UUID, Decision> decisions = new LinkedHashMap<>();
    for (SceneSnapshot scene : scenes) {
      for (BeatSnapshot beat : scene.beats()) {
        decisions.put(beat.visualBeatId(), Decision.generate());
      }
    }
    return Map.copyOf(decisions);
  }

  private static String normalizeProvider(String provider) {
    if (provider == null || provider.isBlank()) return "API";
    if (!"API".equals(provider) && !"GEMINI_WEB".equals(provider)) {
      throw new IllegalArgumentException("Unsupported image generation provider: " + provider);
    }
    return provider;
  }

  private static long estimateDurationMs(List<SceneSnapshot> scenes) {
    long sceneDurationMs =
        scenes.stream()
            .filter(scene -> scene.durationSeconds() != null)
            .mapToLong(scene -> Math.max(0, scene.durationSeconds()) * 1_000L)
            .sum();
    long latestAudioEndMs =
        scenes.stream()
            .flatMap(scene -> scene.beats().stream())
            .filter(beat -> beat.audioEndMs() != null)
            .mapToLong(BeatSnapshot::audioEndMs)
            .max()
            .orElse(0L);
    return Math.max(sceneDurationMs, latestAudioEndMs);
  }

  private static Set<String> significantTokens(String value) {
    Set<String> tokens = new HashSet<>();
    Arrays.stream(TOKEN_SPLIT.split(value))
        .map(String::trim)
        .filter(token -> token.length() >= 3)
        .filter(token -> !STOP_WORDS.contains(token))
        .forEach(tokens::add);
    return tokens;
  }

  private static String normalize(String value) {
    return value == null ? "" : value.toLowerCase(Locale.ROOT).trim();
  }

  public record Decision(String assetStrategy, UUID sourceVisualBeatId) {
    static Decision generate() {
      return new Decision(GENERATE_NEW, null);
    }
  }
}
