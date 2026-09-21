package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.generation.domain.entity.GenerationReference;
import com.narrativex.backend.feature.generation.domain.enums.ReferenceType;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardShotAccess.ShotView;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Plans and validates conditioning reference assets for video generation according to ADR-0028.
 * Image generation is strictly channeled into reference conditioning and keyframes, never directly
 * to final timeline playback.
 */
@Service
public class ReferencePlanner {

  public record ReferencePlanResult(
      List<GenerationReference> references, List<String> missingReferenceRequirements) {
    public boolean isReady() {
      return missingReferenceRequirements.isEmpty();
    }
  }

  /**
   * Plans required conditioning reference assets for a shot given the current inventory of approved
   * character, location, and keyframe assets.
   */
  public ReferencePlanResult planReferences(
      ShotView shot,
      Map<String, UUID> approvedCharacterAssets,
      Map<String, UUID> approvedLocationAssets,
      Map<String, UUID> keyframeAssets) {
    Objects.requireNonNull(shot, "shot must not be null");

    List<GenerationReference> refs = new ArrayList<>();
    List<String> missing = new ArrayList<>();
    GenerationStrategy strategy = shot.generationStrategy();

    // 1. Text-to-Video requires no conditioned images
    if (strategy == GenerationStrategy.TEXT_TO_VIDEO) {
      return new ReferencePlanResult(refs, missing);
    }

    UUID targetShotId =
        shot.id() != null
            ? shot.id()
            : (shot.sequenceId() != null ? shot.sequenceId() : UUID.randomUUID());

    // 2. Image-to-Video requires character reference assets for all visible characters
    if (strategy == GenerationStrategy.IMAGE_TO_VIDEO) {
      List<String> characterNames = parseSubjectNames(shot.subjectsJson());
      for (String character : characterNames) {
        UUID assetId =
            approvedCharacterAssets != null ? approvedCharacterAssets.get(character) : null;
        if (assetId == null) {
          missing.add("Missing approved CHARACTER_REFERENCE for required character: " + character);
        } else {
          refs.add(
              new GenerationReference(
                  targetShotId,
                  ReferenceType.CHARACTER_REFERENCE,
                  assetId,
                  new BigDecimal("1.00")));
        }
      }

      if (shot.locationRef() != null && !shot.locationRef().isBlank()) {
        UUID locAssetId =
            approvedLocationAssets != null ? approvedLocationAssets.get(shot.locationRef()) : null;
        if (locAssetId != null) {
          refs.add(
              new GenerationReference(
                  targetShotId,
                  ReferenceType.LOCATION_REFERENCE,
                  locAssetId,
                  new BigDecimal("0.80")));
        }
      }
    }

    // 3. First/Last Frame requires both start and end frame keyframe references
    if (strategy == GenerationStrategy.FIRST_LAST_FRAME) {
      UUID startAssetId = keyframeAssets != null ? keyframeAssets.get("start") : null;
      UUID endAssetId = keyframeAssets != null ? keyframeAssets.get("end") : null;

      if (startAssetId == null) {
        missing.add("Missing required START_FRAME keyframe asset for FIRST_LAST_FRAME strategy");
      } else {
        refs.add(
            new GenerationReference(
                targetShotId, ReferenceType.START_FRAME, startAssetId, BigDecimal.ONE));
      }

      if (endAssetId == null) {
        missing.add("Missing required END_FRAME keyframe asset for FIRST_LAST_FRAME strategy");
      } else {
        refs.add(
            new GenerationReference(
                targetShotId, ReferenceType.END_FRAME, endAssetId, BigDecimal.ONE));
      }
    }

    // 4. Multi-Keyframe requires at least two keyframe references
    if (strategy == GenerationStrategy.MULTI_KEYFRAME) {
      if (keyframeAssets == null || keyframeAssets.size() < 2) {
        missing.add(
            "MULTI_KEYFRAME strategy requires at least 2 distinct approved keyframe assets");
      } else {
        keyframeAssets.forEach(
            (label, assetId) ->
                refs.add(
                    new GenerationReference(
                        targetShotId, ReferenceType.KEYFRAME, assetId, BigDecimal.ONE)));
      }
    }

    // 5. Video Extend requires valid preceding continuity shot
    if (strategy == GenerationStrategy.VIDEO_EXTEND) {
      if (shot.continuityFromShotId() == null) {
        missing.add("VIDEO_EXTEND strategy requires a valid continuityFromShotId reference");
      }
    }

    return new ReferencePlanResult(refs, missing);
  }

  /** Helper parsing character AI names from subjectsJson. */
  public List<String> parseSubjectNames(String subjectsJson) {
    List<String> names = new ArrayList<>();
    if (subjectsJson == null || subjectsJson.isBlank() || subjectsJson.equals("[]")) {
      return names;
    }

    // Simple robust extractor for {"aiName":"..."} without heavy JSON library coupling
    int index = 0;
    while ((index = subjectsJson.indexOf("\"aiName\":", index)) != -1) {
      int quoteStart = subjectsJson.indexOf("\"", index + 9);
      if (quoteStart != -1) {
        int quoteEnd = subjectsJson.indexOf("\"", quoteStart + 1);
        if (quoteEnd != -1) {
          names.add(subjectsJson.substring(quoteStart + 1, quoteEnd));
          index = quoteEnd + 1;
          continue;
        }
      }
      index += 9;
    }
    return names;
  }
}
