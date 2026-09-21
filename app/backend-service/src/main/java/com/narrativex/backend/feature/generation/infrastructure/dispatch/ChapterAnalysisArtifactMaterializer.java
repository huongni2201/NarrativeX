package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import com.narrativex.backend.feature.generation.application.model.analysis.ChapterCanon;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterCanonParser;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter.ChapterCanonReconciliationService;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.AttentionEventMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.AttentionEventRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterCanonMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.HookPlanMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.HookPlanRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.RetentionMapMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.RetentionMapRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.SceneRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ShotMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ShotRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ShotSequenceMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ShotSequenceRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.StoryBeatRow;
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

/**
 * Validates and materializes the canonical chapter storyboard envelope and retention/shot models.
 */
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
  private final com.narrativex.backend.feature.storyboard.application.service.SourceAnchorResolver
      sourceAnchorResolver;
  private final ChapterCanonMapper canonMapper;
  private final ChapterCanonReconciliationService canonReconciliationService;
  private final HookPlanMapper hookPlanMapper;
  private final RetentionMapMapper retentionMapMapper;
  private final AttentionEventMapper attentionEventMapper;
  private final ShotSequenceMapper shotSequenceMapper;
  private final ShotMapper shotMapper;

  public ChapterAnalysisArtifactMaterializer(
      StoryboardMapper storyboardMapper,
      ChapterMapper chapterMapper,
      com.narrativex.backend.feature.storyboard.application.service.SourceAnchorResolver
          sourceAnchorResolver,
      ChapterCanonMapper canonMapper,
      ChapterCanonReconciliationService canonReconciliationService,
      HookPlanMapper hookPlanMapper,
      RetentionMapMapper retentionMapMapper,
      AttentionEventMapper attentionEventMapper,
      ShotSequenceMapper shotSequenceMapper,
      ShotMapper shotMapper) {
    this.storyboardMapper = storyboardMapper;
    this.chapterMapper = chapterMapper;
    this.sourceAnchorResolver = sourceAnchorResolver;
    this.canonMapper = canonMapper;
    this.canonReconciliationService = canonReconciliationService;
    this.hookPlanMapper = hookPlanMapper;
    this.retentionMapMapper = retentionMapMapper;
    this.attentionEventMapper = attentionEventMapper;
    this.shotSequenceMapper = shotSequenceMapper;
    this.shotMapper = shotMapper;
  }

  public ChapterAnalysisArtifactMaterializer(
      StoryboardMapper storyboardMapper,
      ChapterMapper chapterMapper,
      com.narrativex.backend.feature.storyboard.application.service.SourceAnchorResolver
          sourceAnchorResolver,
      ChapterCanonMapper canonMapper,
      ChapterCanonReconciliationService canonReconciliationService) {
    this(
        storyboardMapper,
        chapterMapper,
        sourceAnchorResolver,
        canonMapper,
        canonReconciliationService,
        null,
        null,
        null,
        null,
        null);
  }

  public ChapterAnalysisArtifactMaterializer(
      StoryboardMapper storyboardMapper,
      ChapterMapper chapterMapper,
      com.narrativex.backend.feature.storyboard.application.service.SourceAnchorResolver
          sourceAnchorResolver) {
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

    Instant now = Instant.now();

    // Materialize Hook Plan if present
    if (hookPlanMapper != null && (root.has("hook_plan") || root.has("hookPlan"))) {
      JsonNode hookNode = root.has("hook_plan") ? root.get("hook_plan") : root.get("hookPlan");
      if (hookNode != null && hookNode.isObject()) {
        HookPlanRow hookRow = new HookPlanRow();
        hookRow.setChapterId(job.getChapterId());
        hookRow.setPromise(text(hookNode, "promise", ""));
        hookRow.setConflict(text(hookNode, "conflict", ""));
        hookRow.setCuriosityQuestion(
            text(hookNode, "curiosity_question", text(hookNode, "curiosityQuestion", "")));
        hookRow.setVisualHook(text(hookNode, "visual_hook", text(hookNode, "visualHook", "")));
        hookRow.setDialogueHook(
            text(hookNode, "dialogue_hook", text(hookNode, "dialogueHook", "")));
        hookRow.setWithheldInformation(
            text(hookNode, "withheld_information", text(hookNode, "withheldInformation", "")));
        hookRow.setCreatedAt(now);
        hookRow.setUpdatedAt(now);
        hookPlanMapper.insert(hookRow);
      }
    }

    // Materialize Retention Map and Attention Events if present
    if (retentionMapMapper != null && (root.has("retention_map") || root.has("retentionMap"))) {
      JsonNode retNode =
          root.has("retention_map") ? root.get("retention_map") : root.get("retentionMap");
      if (retNode != null && retNode.isObject()) {
        RetentionMapRow retRow = new RetentionMapRow();
        retRow.setChapterId(job.getChapterId());
        retRow.setTensionCurveJson(
            retNode.has("tension_curve")
                ? retNode.get("tension_curve").toString()
                : (retNode.has("tensionCurve") ? retNode.get("tensionCurve").toString() : "[]"));
        retRow.setOpenQuestionsJson(
            retNode.has("open_questions")
                ? retNode.get("open_questions").toString()
                : (retNode.has("openQuestions") ? retNode.get("openQuestions").toString() : "[]"));
        retRow.setResolvedQuestionsJson(
            retNode.has("resolved_questions")
                ? retNode.get("resolved_questions").toString()
                : (retNode.has("resolvedQuestions")
                    ? retNode.get("resolvedQuestions").toString()
                    : "[]"));
        retRow.setPacingWarningsJson(
            retNode.has("pacing_warnings")
                ? retNode.get("pacing_warnings").toString()
                : (retNode.has("pacingWarnings")
                    ? retNode.get("pacingWarnings").toString()
                    : "[]"));
        retRow.setCreatedAt(now);
        retRow.setUpdatedAt(now);
        UUID mapId = retentionMapMapper.insert(retRow);

        if (attentionEventMapper != null) {
          JsonNode eventsNode = firstArray(retNode, "attention_events", "attentionEvents");
          if (eventsNode != null && eventsNode.isArray()) {
            List<AttentionEventRow> eventRows = new ArrayList<>();
            for (JsonNode ev : eventsNode) {
              AttentionEventRow evRow = new AttentionEventRow();
              evRow.setRetentionMapId(mapId);
              evRow.setEventType(text(ev, "event_type", text(ev, "eventType", "INFO")));
              evRow.setTimeOffsetMs(
                  ev.has("time_offset_ms")
                      ? ev.get("time_offset_ms").asLong(0)
                      : (ev.has("timeOffsetMs") ? ev.get("timeOffsetMs").asLong(0) : 0L));
              evRow.setDescription(text(ev, "description", ""));
              evRow.setSeverity(text(ev, "severity", "INFO"));
              evRow.setCreatedAt(now);
              evRow.setUpdatedAt(now);
              eventRows.add(evRow);
            }
            if (!eventRows.isEmpty()) {
              attentionEventMapper.insertBatch(eventRows);
            }
          }
        }
      }
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
    List<
            com.narrativex.backend.feature.storyboard.application.service.SourceAnchorResolver
                .ResolvedSourceAnchor>
        resolvedAnchors =
            sourceAnchorResolver.resolveAll(
                job.getSourceText(), job.getSourceHash(), orderedAnchors);

    // Pass 2: Materialize scenes, visual beats, shots, and character bindings with validated UTF-16
    // ranges
    int globalBeatIndex = 0;
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
            String charRef =
                charNode.isTextual()
                    ? charNode.asText()
                    : text(charNode, "ai_name", text(charNode, "name", null));
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

        StoryBeatRow storyBeatRow = new StoryBeatRow();
        storyBeatRow.setSceneId(sceneId);
        storyBeatRow.setOrderIndex(beatIndex);
        storyBeatRow.setSourceStart(resolvedAnchor.textStart());
        storyBeatRow.setSourceEnd(resolvedAnchor.textEnd());
        storyBeatRow.setSourceAnchorJson(resolvedAnchor.sourceAnchorJson());
        storyBeatRow.setPurpose(requiredText(beat, "visual_intent", "visual beat visual_intent"));
        storyBeatRow.setSummary(requiredText(beat, "title", "visual beat title"));
        storyBeatRow.setImportance(text(beat, "importance", "NORMAL"));
        storyBeatRow.setStoryFunctionsJson("[]");
        storyBeatRow.setContinuityStateJson("{}");
        storyBeatRow.setReviewStatus("NEEDS_REVIEW");
        storyBeatRow.setCreatedAt(now);
        storyBeatRow.setUpdatedAt(now);
        UUID storyBeatId = storyboardMapper.insertStoryBeat(storyBeatRow);

        VisualBeatRow beatRow = new VisualBeatRow();
        beatRow.setSceneId(sceneId);
        beatRow.setStoryBeatId(storyBeatId);
        beatRow.setOrderIndex(beatIndex);
        beatRow.setTitle(requiredText(beat, "title", "visual beat title"));
        beatRow.setVisualIntent(requiredText(beat, "visual_intent", "visual beat visual_intent"));
        beatRow.setVisualDirectionJson(direction.toString());
        beatRow.setDramaticIntent(
            text(beat, "dramatic_intent", text(beat, "dramaticIntent", "SETUP")));
        beatRow.setEmotion(text(beat, "emotion", null));
        beatRow.setRetentionRole(text(beat, "retention_role", text(beat, "retentionRole", null)));
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
              String charRef =
                  charNode.isTextual()
                      ? charNode.asText()
                      : text(charNode, "ai_name", text(charNode, "name", null));
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

        // Materialize shot sequences and shots
        JsonNode shotsNode = firstArray(beat, "shots", "shot_sequence", "shotSequence");
        if (shotSequenceMapper != null
            && shotMapper != null
            && shotsNode != null
            && shotsNode.isArray()
            && !shotsNode.isEmpty()) {
          ShotSequenceRow seqRow = new ShotSequenceRow();
          seqRow.setVisualBeatId(beatId);
          seqRow.setOrderIndex(0);
          seqRow.setCreatedAt(now);
          seqRow.setUpdatedAt(now);
          UUID seqId = shotSequenceMapper.insert(seqRow);

          List<ShotRow> shotRows = new ArrayList<>();
          for (int shotIndex = 0; shotIndex < shotsNode.size(); shotIndex++) {
            JsonNode shotItem = shotsNode.get(shotIndex);
            ShotRow shotRow = new ShotRow();
            shotRow.setSequenceId(seqId);
            shotRow.setOrderIndex(shotIndex);
            shotRow.setNarrativePurpose(
                text(
                    shotItem,
                    "narrative_purpose",
                    text(shotItem, "narrativePurpose", text(shotItem, "purpose", ""))));
            shotRow.setRetentionRole(
                text(shotItem, "retention_role", text(shotItem, "retentionRole", null)));
            shotRow.setSubjectsJson(
                shotItem.has("subjects") ? shotItem.get("subjects").toString() : "[]");
            shotRow.setLocationRef(
                text(shotItem, "location_ref", text(shotItem, "locationRef", null)));
            shotRow.setStartStateJson(
                shotItem.has("start_state")
                    ? shotItem.get("start_state").toString()
                    : (shotItem.has("startState") ? shotItem.get("startState").toString() : "{}"));
            shotRow.setActionJson(
                shotItem.has("action")
                    ? (shotItem.get("action").isObject()
                        ? shotItem.get("action").toString()
                        : "{\"action\":\""
                            + shotItem.get("action").asText().replace("\"", "\\\"")
                            + "\"}")
                    : "{}");
            shotRow.setEndStateJson(
                shotItem.has("end_state")
                    ? shotItem.get("end_state").toString()
                    : (shotItem.has("endState") ? shotItem.get("endState").toString() : "{}"));
            shotRow.setCompositionJson(
                shotItem.has("composition")
                    ? (shotItem.get("composition").isObject()
                        ? shotItem.get("composition").toString()
                        : "{\"composition\":\""
                            + shotItem.get("composition").asText().replace("\"", "\\\"")
                            + "\"}")
                    : "{}");
            shotRow.setCameraJson(
                shotItem.has("camera")
                    ? (shotItem.get("camera").isObject()
                        ? shotItem.get("camera").toString()
                        : "{\"camera\":\""
                            + shotItem.get("camera").asText().replace("\"", "\\\"")
                            + "\"}")
                    : "{}");
            shotRow.setSubjectMotionJson(
                shotItem.has("subject_motion")
                    ? (shotItem.get("subject_motion").isObject()
                        ? shotItem.get("subject_motion").toString()
                        : "{\"subjectMotion\":\""
                            + shotItem.get("subject_motion").asText().replace("\"", "\\\"")
                            + "\"}")
                    : "{}");
            shotRow.setCameraMotionJson(
                shotItem.has("camera_motion")
                    ? (shotItem.get("camera_motion").isObject()
                        ? shotItem.get("camera_motion").toString()
                        : "{\"cameraMotion\":\""
                            + shotItem.get("camera_motion").asText().replace("\"", "\\\"")
                            + "\"}")
                    : "{}");
            shotRow.setEnvironmentMotionJson(
                shotItem.has("environment_motion")
                    ? (shotItem.get("environment_motion").isObject()
                        ? shotItem.get("environment_motion").toString()
                        : "{\"environmentMotion\":\""
                            + shotItem.get("environment_motion").asText().replace("\"", "\\\"")
                            + "\"}")
                    : "{}");
            shotRow.setTargetDurationMs(
                shotItem.has("target_duration_ms")
                    ? shotItem.get("target_duration_ms").asLong(4000)
                    : (shotItem.has("targetDurationMs")
                        ? shotItem.get("targetDurationMs").asLong(4000)
                        : 4000L));
            shotRow.setGenerationStrategy(
                text(
                    shotItem,
                    "generation_strategy",
                    text(shotItem, "generationStrategy", "TEXT_TO_VIDEO")));
            shotRow.setQualityProfile(
                text(
                    shotItem,
                    "quality_profile",
                    text(shotItem, "qualityProfile", "720p_24fps_standard")));
            shotRow.setStatus(text(shotItem, "status", "PLANNED"));
            shotRow.setCreatedAt(now);
            shotRow.setUpdatedAt(now);
            shotRows.add(shotRow);
          }
          if (!shotRows.isEmpty()) {
            shotMapper.insertBatch(shotRows);
          }
        } else if (shotSequenceMapper != null && shotMapper != null) {
          ShotSequenceRow seqRow = new ShotSequenceRow();
          seqRow.setVisualBeatId(beatId);
          seqRow.setOrderIndex(0);
          seqRow.setCreatedAt(now);
          seqRow.setUpdatedAt(now);
          UUID seqId = shotSequenceMapper.insert(seqRow);

          ShotRow defaultShot = new ShotRow();
          defaultShot.setSequenceId(seqId);
          defaultShot.setOrderIndex(0);
          defaultShot.setNarrativePurpose(
              beatRow.getTitle() != null ? beatRow.getTitle() : "Visual Beat Shot");
          defaultShot.setRetentionRole(beatRow.getRetentionRole());
          defaultShot.setSubjectsJson("[]");
          defaultShot.setLocationRef(sceneRow.getLocationText());
          defaultShot.setStartStateJson("{}");
          defaultShot.setActionJson(
              "{\"action\":\""
                  + (beatRow.getVisualIntent() != null
                      ? beatRow.getVisualIntent().replace("\"", "\\\"")
                      : "")
                  + "\"}");
          defaultShot.setEndStateJson("{}");
          defaultShot.setCompositionJson("{}");
          defaultShot.setCameraJson("{}");
          defaultShot.setSubjectMotionJson("{}");
          defaultShot.setCameraMotionJson("{}");
          defaultShot.setEnvironmentMotionJson("{}");
          defaultShot.setTargetDurationMs(4000L);
          defaultShot.setGenerationStrategy("TEXT_TO_VIDEO");
          defaultShot.setQualityProfile("720p_24fps_standard");
          defaultShot.setStatus("PLANNED");
          defaultShot.setCreatedAt(now);
          defaultShot.setUpdatedAt(now);
          shotMapper.insert(defaultShot);
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
