package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.generation.domain.entity.GenerationReference;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardShotAccess.ShotView;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Model-agnostic routing service implementing ADR-0029 decision matrix. Determines the execution
 * strategy, conditioned reference assets, compiled prompt, and preflight readiness for a Shot.
 */
@Service
public class GenerationRouter {

  public record GenerationPlan(
      UUID shotId,
      GenerationStrategy strategy,
      List<GenerationReference> references,
      VideoPromptCompiler.CompiledVideoPrompt compiledPrompt,
      String qualityProfile,
      UUID continuitySourceAssetId,
      boolean readyForAdmission,
      List<String> blockingPreflightReasons) {}

  private final ReferencePlanner referencePlanner;
  private final VideoPromptCompiler videoPromptCompiler;

  public GenerationRouter(
      ReferencePlanner referencePlanner, VideoPromptCompiler videoPromptCompiler) {
    this.referencePlanner =
        Objects.requireNonNull(referencePlanner, "referencePlanner must not be null");
    this.videoPromptCompiler =
        Objects.requireNonNull(videoPromptCompiler, "videoPromptCompiler must not be null");
  }

  /** Routes a Shot into a concrete GenerationPlan. */
  public GenerationPlan route(
      ShotView shot,
      ImageStyle style,
      Map<String, UUID> approvedCharacterAssets,
      Map<String, UUID> approvedLocationAssets,
      Map<String, UUID> keyframeAssets,
      String continuityContext,
      UUID continuitySourceAssetId) {
    Objects.requireNonNull(shot, "shot must not be null");

    List<String> blockingReasons = new ArrayList<>();
    GenerationStrategy strategy = shot.generationStrategy();

    // 1. Resolve references via ReferencePlanner
    ReferencePlanner.ReferencePlanResult refResult =
        referencePlanner.planReferences(
            shot, approvedCharacterAssets, approvedLocationAssets, keyframeAssets);

    if (!refResult.isReady()) {
      blockingReasons.addAll(refResult.missingReferenceRequirements());
    }

    // 2. Validate strategy-specific invariants
    if (strategy == GenerationStrategy.VIDEO_EXTEND && continuitySourceAssetId == null) {
      blockingReasons.add("VIDEO_EXTEND requires a valid preceding continuity media asset ID");
    }

    // 3. Compile prompt
    VideoPromptCompiler.CompiledVideoPrompt compiledPrompt =
        videoPromptCompiler.compile(shot, style, continuityContext);

    boolean ready = blockingReasons.isEmpty();

    return new GenerationPlan(
        shot.id(),
        strategy,
        refResult.references(),
        compiledPrompt,
        shot.qualityProfile(),
        continuitySourceAssetId,
        ready,
        blockingReasons);
  }
}
