package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import com.narrativex.backend.feature.generation.application.model.analysis.AnalyzedCharacter;
import com.narrativex.backend.feature.generation.application.model.analysis.AnalyzedLocation;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterCanon;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterCanonParser;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter.ChapterCanonReconciliationService;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterCanonMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.SceneRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.StoryboardMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.VisualBeatRow;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Validates and materializes the canonical chapter storyboard envelope. */
public final class ChapterAnalysisArtifactMaterializer {
  private static final JsonMapper JSON = JsonMapper.builder().build();
  private static final List<String> REQUIRED_DIRECTION_FIELDS =
      List.of(
          "shot_size",
          "camera_angle",
          "lens_mm",
          "focus_target",
          "action_phase",
          "subject_placement",
          "background",
          "motivated_light",
          "palette",
          "camera_movement",
          "movement_intensity",
          "crop_safe_area");

  private final StoryboardMapper storyboardMapper;
  private final ChapterMapper chapterMapper;
  private final com.narrativex.backend.feature.storyboard.application.service.SourceAnchorResolver sourceAnchorResolver;
  private final ChapterCanonMapper canonMapper;
  private final ChapterCanonReconciliationService canonReconciliationService;

  public ChapterAnalysisArtifactMaterializer(
      StoryboardMapper storyboardMapper,
      ChapterMapper chapterMapper,
      com.narrativex.backend.feature.storyboard.application.service.SourceAnchorResolver sourceAnchorResolver,
      ChapterCanonMapper canonMapper,
      ChapterCanonReconciliationService canonReconciliationService) {
    this.storyboardMapper = storyboardMapper;
    this.chapterMapper = chapterMapper;
    this.sourceAnchorResolver = sourceAnchorResolver;
    this.canonMapper = canonMapper;
    this.canonReconciliationService = canonReconciliationService;
  }

  public ChapterAnalysisArtifactMaterializer(
      StoryboardMapper storyboardMapper,
      ChapterMapper chapterMapper,
      com.narrativex.backend.feature.storyboard.application.service.SourceAnchorResolver sourceAnchorResolver) {
    this(storyboardMapper, chapterMapper, sourceAnchorResolver, null, null);
  }

  public ChapterAnalysisArtifactMaterializer(
      StoryboardMapper storyboardMapper, ChapterMapper chapterMapper) {
    this(
        storyboardMapper,
        chapterMapper,
        new com.narrativex.backend.feature.storyboard.application.service.SourceAnchorResolver(),
        null,
        null);
  }

  public void materialize(GenerationJob job, byte[] payload) {
    JsonNode root = parse(payload);
    JsonNode scenes = requiredArray(root, "scenes");
    if (scenes.isEmpty()) throw invalid("analysis output must contain at least one scene");
    if (job.getSourceText() == null || job.getSourceText().isBlank()) {
      throw invalid("analysis job source text is missing");
    }
    if (!storyboardMapper.findCurrentScenes(job.getChapterId()).isEmpty()) {
      throw invalid("storyboard revision already contains materialized scenes");
    }

    // Reconcile and persist narrative canon (characters, locations) if service provided
    ChapterCanonReconciliationService.ReconciledCanon reconciled = null;
    if (canonReconciliationService != null) {
      JsonNode canonNode = root.get("canon");
      ChapterCanon canon = parseCanon(canonNode);
      if (canon != null) {
        reconciled = canonReconciliationService.reconcileAndPersist(job.getProjectId(), canon);
      }
    }

    // Pass 1: Pre-validate all scenes, directions, and collect ordered source anchors
    List<String> orderedAnchors = new ArrayList<>();
    for (int sceneIndex = 0; sceneIndex < scenes.size(); sceneIndex++) {
      JsonNode scene = object(scenes.get(sceneIndex), "scene " + sceneIndex);
      requiredText(scene, "title", "scene " + sceneIndex + " title");
      JsonNode beats = firstArray(scene, "visual_beats", "visualBeats");
      if (beats == null || beats.isEmpty()) {
        throw invalid("scene " + sceneIndex + " must contain visual beats");
      }
      for (int beatIndex = 0; beatIndex < beats.size(); beatIndex++) {
        JsonNode beat = object(beats.get(beatIndex), "scene " + sceneIndex + " beat " + beatIndex);
        String anchor =
            requiredText(
                beat,
                "source_anchor",
                "scene " + sceneIndex + " beat " + beatIndex + " source_anchor");
        orderedAnchors.add(anchor);
        JsonNode direction = firstObject(beat, "visual_direction", "visualDirection");
        if (direction == null) {
          throw invalid("visual beat is missing visual_direction");
        }
        for (String field : REQUIRED_DIRECTION_FIELDS) {
          requiredValue(direction, field, "visual_direction." + field);
        }
      }
    }

    // Deterministically resolve all anchors before performing any database writes
    List<com.narrativex.backend.feature.storyboard.application.service.SourceAnchorResolver.ResolvedSourceAnchor>
        resolvedAnchors =
            sourceAnchorResolver.resolveAll(
                job.getSourceText(), job.getSourceHash(), orderedAnchors);

    // Pass 2: Materialize scenes, visual beats, and character bindings with validated UTF-16 ranges
    int globalBeatIndex = 0;
    Instant now = Instant.now();
    for (int sceneIndex = 0; sceneIndex < scenes.size(); sceneIndex++) {
      JsonNode scene = scenes.get(sceneIndex);
      String title = requiredText(scene, "title", "scene " + sceneIndex + " title");
      String narration = text(scene, "narration", "");
      JsonNode beats = firstArray(scene, "visual_beats", "visualBeats");

      SceneRow sceneRow = new SceneRow();
      sceneRow.setChapterId(job.getChapterId());
      sceneRow.setStoryboardRevisionId(job.getStoryboardRevisionId());
      sceneRow.setProjectId(job.getProjectId());
      sceneRow.setOrderIndex(sceneIndex);
      sceneRow.setTitle(title);
      sceneRow.setNarration(narration);
      sceneRow.setStatus("DRAFT");
      sceneRow.setCreatedAt(now);
      sceneRow.setUpdatedAt(now);

      String locationRef = text(scene, "location", null);
      if (locationRef != null && !locationRef.isBlank()) {
        sceneRow.setLocationText(locationRef);
        if (reconciled != null) {
          sceneRow.setProjectLocationId(reconciled.findLocationId(locationRef));
        }
      }
      UUID sceneId = storyboardMapper.insertScene(sceneRow);

      // Materialize scene_characters
      if (canonMapper != null && reconciled != null) {
        JsonNode sceneCharacters = firstArray(scene, "characters", "scene_characters");
        if (sceneCharacters != null && sceneCharacters.isArray()) {
          int charOrder = 0;
          Set<UUID> addedSceneChars = new HashSet<>();
          for (JsonNode charNode : sceneCharacters) {
            String charRef = charNode.isTextual() ? charNode.asText() : text(charNode, "ai_name", text(charNode, "name", null));
            if (charRef != null && !charRef.isBlank()) {
              UUID projectCharId = reconciled.findCharacterId(charRef);
              if (projectCharId != null && addedSceneChars.add(projectCharId)) {
                canonMapper.insertSceneCharacter(sceneId, charOrder++, projectCharId);
              }
            }
          }
        }
      }

      for (int beatIndex = 0; beatIndex < beats.size(); beatIndex++) {
        JsonNode beat = beats.get(beatIndex);
        JsonNode direction = firstObject(beat, "visual_direction", "visualDirection");
        var resolvedAnchor = resolvedAnchors.get(globalBeatIndex++);

        VisualBeatRow beatRow = new VisualBeatRow();
        beatRow.setSceneId(sceneId);
        beatRow.setOrderIndex(beatIndex);
        beatRow.setTitle(requiredText(beat, "title", "visual beat title"));
        beatRow.setVisualIntent(requiredText(beat, "visual_intent", "visual beat visual_intent"));
        beatRow.setVisualDirectionJson(direction.toString());
        beatRow.setReviewStatus("NEEDS_REVIEW");
        beatRow.setMotionMode("STILL");
        beatRow.setTextStart(resolvedAnchor.textStart());
        beatRow.setTextEnd(resolvedAnchor.textEnd());
        beatRow.setSourceAnchorJson(resolvedAnchor.sourceAnchorJson());
        beatRow.setCreatedAt(now);
        beatRow.setUpdatedAt(now);
        UUID beatId = storyboardMapper.insertVisualBeat(beatRow);

        // Materialize visual_beat_characters
        if (canonMapper != null && reconciled != null) {
          JsonNode beatCharacters = firstArray(beat, "characters", "beat_characters");
          if (beatCharacters != null && beatCharacters.isArray()) {
            Set<UUID> addedBeatChars = new HashSet<>();
            for (JsonNode charNode : beatCharacters) {
              String charRef = charNode.isTextual() ? charNode.asText() : text(charNode, "ai_name", text(charNode, "name", null));
              String role = charNode.isObject() ? text(charNode, "role", "SECONDARY") : "SECONDARY";
              if (charRef != null && !charRef.isBlank()) {
                UUID projectCharId = reconciled.findCharacterId(charRef);
                if (projectCharId != null && addedBeatChars.add(projectCharId)) {
                  canonMapper.insertVisualBeatCharacter(beatId, projectCharId, role);
                }
              }
            }
          }
        }
      }
    }
    ChapterRow chapter = chapterMapper.findById(job.getChapterId());
    if (chapter == null) throw invalid("analysis chapter materialization target is missing");
    chapter.setCurrentStoryboardRevisionId(job.getStoryboardRevisionId());
    if (chapterMapper.update(chapter) == 0) {
      throw invalid("analysis chapter changed before storyboard activation");
    }
  }

  private static ChapterCanon parseCanon(JsonNode node) {
    return ChapterCanonParser.parse(node);
  }

  private static List<String> parseStringList(JsonNode arr) {
    if (arr == null || !arr.isArray()) {
      return List.of();
    }
    List<String> result = new ArrayList<>();
    for (JsonNode item : arr) {
      if (item.isTextual() && !item.asText().isBlank()) {
        result.add(item.asText().trim());
      }
    }
    return result;
  }

  private static JsonNode parse(byte[] payload) {
    if (payload == null || payload.length == 0) throw invalid("analysis output is empty");
    try {
      JsonNode root = JSON.readTree(new String(payload, StandardCharsets.UTF_8));
      return object(root, "analysis output");
    } catch (RuntimeException exception) {
      throw invalid("analysis output is not valid JSON", exception);
    }
  }

  private static JsonNode requiredArray(JsonNode node, String field) {
    JsonNode value = node.get(field);
    if (value == null || !value.isArray()) throw invalid("analysis output is missing " + field);
    return value;
  }

  private static JsonNode firstArray(JsonNode node, String... fields) {
    for (String field : fields) {
      JsonNode value = node.get(field);
      if (value != null && value.isArray()) return value;
    }
    return null;
  }

  private static JsonNode firstObject(JsonNode node, String... fields) {
    for (String field : fields) {
      JsonNode value = node.get(field);
      if (value != null && value.isObject()) return value;
    }
    return null;
  }

  private static JsonNode object(JsonNode node, String context) {
    if (node == null || !node.isObject()) throw invalid(context + " must be an object");
    return node;
  }

  private static String requiredText(JsonNode node, String field, String context) {
    JsonNode value = node.get(field);
    if (value == null || !value.isTextual() || value.asText().isBlank()) {
      throw invalid(context + " must be a non-blank string");
    }
    return value.asText();
  }

  private static void requiredValue(JsonNode node, String field, String context) {
    JsonNode value = node.get(field);
    if (value == null
        || value.isNull()
        || (value.isTextual() && value.asText().isBlank())
        || (!value.isTextual() && !value.isNumber())) {
      throw invalid(context + " must be a non-blank value");
    }
  }

  private static String text(JsonNode node, String field, String fallback) {
    JsonNode value = node.get(field);
    return value != null && value.isTextual() ? value.asText() : fallback;
  }

  private static IllegalArgumentException invalid(String message) {
    return new IllegalArgumentException(message);
  }

  private static IllegalArgumentException invalid(String message, Throwable cause) {
    return new IllegalArgumentException(message, cause);
  }
}
