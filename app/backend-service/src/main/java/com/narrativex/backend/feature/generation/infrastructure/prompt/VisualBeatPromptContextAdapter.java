package com.narrativex.backend.feature.generation.infrastructure.prompt;

import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.port.in.VisualBeatPromptContext;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.VisualPromptContext;
import com.narrativex.backend.feature.generation.application.service.StoryboardVisualPromptComposer;
import com.narrativex.backend.feature.generation.application.service.VisualPromptComposer.ComposedVisualPrompt;
import com.narrativex.backend.feature.storyboard.api.response.VisualBeatResponse;
import com.narrativex.backend.feature.storyboard.application.usecase.GetChapterStoryboardUseCase;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class VisualBeatPromptContextAdapter implements VisualBeatPromptContext {
  private static final int MAX_REFERENCE_IMAGES = 3;

  private final GetChapterStoryboardUseCase getChapterStoryboardUseCase;
  private final VisualPromptContextRepository visualPromptContextRepository;
  private final StoryboardVisualPromptComposer storyboardVisualPromptComposer;

  @Override
  public ComposedVisualPrompt get(UUID projectId, UUID chapterId, UUID visualBeatId) {
    return prepare(projectId, chapterId, visualBeatId).composedPrompt();
  }

  @Override
  public PreparedVisualBeatPrompt prepare(UUID projectId, UUID chapterId, UUID visualBeatId) {
    var result = prepareMany(projectId, chapterId, List.of(visualBeatId)).get(visualBeatId);
    if (result == null) {
      throw new ResourceNotFoundException("Visual Beat not found in the current Chapter storyboard");
    }
    if (result.hasConflict()) {
      throw new ResourceConflictException(result.conflictMessage());
    }
    return result.prepared();
  }

  @Override
  public Map<UUID, Preparation> prepareMany(
      UUID projectId, UUID chapterId, List<UUID> visualBeatIds) {
    if (visualBeatIds == null || visualBeatIds.isEmpty()) {
      return Map.of();
    }

    var storyboard = getChapterStoryboardUseCase.execute(projectId, chapterId).data();
    Map<UUID, VisualBeatResponse> beatsById =
        storyboard.scenes().stream()
            .flatMap(scene -> scene.visualBeats().stream())
            .collect(Collectors.toMap(VisualBeatResponse::id, Function.identity()));

    for (UUID visualBeatId : visualBeatIds) {
      if (!beatsById.containsKey(visualBeatId)) {
        throw new ResourceNotFoundException(
            "Visual Beat not found in the current Chapter storyboard");
      }
    }

    Map<UUID, VisualPromptContext> contexts =
        visualPromptContextRepository.findForBeats(projectId, visualBeatIds);
    Map<UUID, Preparation> prepared = new LinkedHashMap<>();
    for (UUID visualBeatId : visualBeatIds) {
      var beat = beatsById.get(visualBeatId);
      var context = contexts.getOrDefault(visualBeatId, VisualPromptContext.empty());
      String conflict = referenceBudgetConflict(context);
      if (conflict != null) {
        prepared.put(visualBeatId, Preparation.conflict(conflict));
        continue;
      }

      String aspectRatio =
          beat.aspectRatioOverride() == null ? null : beat.aspectRatioOverride().name();
      var composed =
          storyboardVisualPromptComposer.compose(
              beat.visualIntent(), beat.visualDirectionJson(), aspectRatio, context);
      var continuity = context.continuity();
      prepared.put(
          visualBeatId,
          Preparation.ready(
              new PreparedVisualBeatPrompt(
                  beat.id(),
                  beat.sceneId(),
                  beat.rowVersion(),
                  continuity == null ? null : continuity.planId(),
                  continuity == null ? null : continuity.semanticHash(),
                  composed)));
    }
    return Map.copyOf(prepared);
  }

  private static String referenceBudgetConflict(VisualPromptContext context) {
    long requiredIdentityReferences =
        context.characters().stream().filter(character -> !character.references().isEmpty()).count();
    if (requiredIdentityReferences <= MAX_REFERENCE_IMAGES) {
      return null;
    }
    return "REFERENCE_BUDGET_EXCEEDED: Visual Beat requires identity references for "
        + requiredIdentityReferences
        + " participating characters but Gemini Web supports at most "
        + MAX_REFERENCE_IMAGES
        + ".";
  }
}
