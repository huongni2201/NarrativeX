package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.SceneRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.StoryboardMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.VisualBeatRow;
import java.nio.charset.StandardCharsets;
import java.util.List;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Validates and materializes the canonical chapter storyboard envelope. */
final class ChapterAnalysisArtifactMaterializer {
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

  ChapterAnalysisArtifactMaterializer(
      StoryboardMapper storyboardMapper, ChapterMapper chapterMapper) {
    this.storyboardMapper = storyboardMapper;
    this.chapterMapper = chapterMapper;
  }

  void materialize(GenerationJob job, byte[] payload) {
    JsonNode root = parse(payload);
    JsonNode scenes = requiredArray(root, "scenes");
    if (scenes.isEmpty()) throw invalid("analysis output must contain at least one scene");
    if (job.getSourceText() == null || job.getSourceText().isBlank()) {
      throw invalid("analysis job source text is missing");
    }
    if (!storyboardMapper.findCurrentScenes(job.getChapterId()).isEmpty()) {
      throw invalid("storyboard revision already contains materialized scenes");
    }

    for (int sceneIndex = 0; sceneIndex < scenes.size(); sceneIndex++) {
      JsonNode scene = object(scenes.get(sceneIndex), "scene " + sceneIndex);
      String title = requiredText(scene, "title", "scene " + sceneIndex + " title");
      String narration = text(scene, "narration", "");
      JsonNode beats = firstArray(scene, "visual_beats", "visualBeats");
      if (beats == null || beats.isEmpty()) {
        throw invalid("scene " + sceneIndex + " must contain visual beats");
      }
      SceneRow sceneRow = new SceneRow();
      sceneRow.setChapterId(job.getChapterId());
      sceneRow.setStoryboardRevisionId(job.getStoryboardRevisionId());
      sceneRow.setProjectId(job.getProjectId());
      sceneRow.setOrderIndex(sceneIndex);
      sceneRow.setTitle(title);
      sceneRow.setNarration(narration);
      sceneRow.setStatus("DRAFT");
      java.util.UUID sceneId = storyboardMapper.insertScene(sceneRow);

      for (int beatIndex = 0; beatIndex < beats.size(); beatIndex++) {
        JsonNode beat = object(beats.get(beatIndex), "scene " + sceneIndex + " beat " + beatIndex);
        String anchor =
            requiredText(
                beat,
                "source_anchor",
                "scene " + sceneIndex + " beat " + beatIndex + " source_anchor");
        if (!job.getSourceText().contains(anchor)) {
          throw invalid("analysis source_anchor is not present in the source snapshot");
        }
        JsonNode direction = firstObject(beat, "visual_direction", "visualDirection");
        if (direction == null) {
          throw invalid("visual beat is missing visual_direction");
        }
        for (String field : REQUIRED_DIRECTION_FIELDS) {
          requiredValue(direction, field, "visual_direction." + field);
        }
        VisualBeatRow beatRow = new VisualBeatRow();
        beatRow.setSceneId(sceneId);
        beatRow.setOrderIndex(beatIndex);
        beatRow.setTitle(requiredText(beat, "title", "visual beat title"));
        beatRow.setVisualIntent(requiredText(beat, "visual_intent", "visual beat visual_intent"));
        beatRow.setVisualDirectionJson(direction.toString());
        beatRow.setReviewStatus("NEEDS_REVIEW");
        beatRow.setMotionMode("STILL");
        storyboardMapper.insertVisualBeat(beatRow);
      }
    }
    ChapterRow chapter = chapterMapper.findById(job.getChapterId());
    if (chapter == null) throw invalid("analysis chapter materialization target is missing");
    chapter.setCurrentStoryboardRevisionId(job.getStoryboardRevisionId());
    if (chapterMapper.update(chapter) == 0) {
      throw invalid("analysis chapter changed before storyboard activation");
    }
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
