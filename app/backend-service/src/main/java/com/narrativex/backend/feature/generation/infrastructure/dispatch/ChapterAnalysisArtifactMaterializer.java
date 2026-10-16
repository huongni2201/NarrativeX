package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import com.narrativex.backend.feature.generation.application.model.analysis.ChapterCanon;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterCanonParser;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.storyboard.application.service.SourceAnchorResolver;
import com.narrativex.backend.feature.storyboard.domain.enums.DramaticIntent;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter.ChapterCanonReconciliationService;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.AttentionEventMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.AttentionEventRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.AudioCueRow;
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
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Validates and materializes the canonical chapter storyboard envelope and retention/shot models.
 */
public final class ChapterAnalysisArtifactMaterializer {
  private static final Logger LOG =
      LoggerFactory.getLogger(ChapterAnalysisArtifactMaterializer.class);
  private static final JsonMapper JSON = JsonMapper.builder().build();

  /**
   * Characters a visual beat may narrate before it exceeds the 10 s budget (ADR-0006); a warning,
   * not a rejection.
   */
  static final int BEAT_MAX_CHARS = 150;

  /**
   * Provisional narration speed (about 14 characters per second); real timing comes from TTS
   * alignment.
   */
  private static final long MS_PER_CHAR = 70;

  private static final long MIN_SHOT_MS = 2_000;
  private static final long MAX_SHOT_MS = 10_000;
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
    ChapterRow chapter = chapterMapper.findById(job.getChapterId());
    if (chapter == null) throw invalid("analysis chapter materialization target is missing");
    if (!Objects.equals(chapter.getSourceHash(), job.getSourceHash())
        || (job.getChapterRowVersion() != null
            && chapter.getRowVersion() != job.getChapterRowVersion())) {
      throw invalid("analysis chapter source changed before materialization");
    }
    if (!storyboardMapper.findCurrentScenes(job.getChapterId()).isEmpty()) {
      throw invalid("storyboard revision already contains materialized scenes");
    }

    Instant now = Instant.now();

    // Pass 1: Pre-validate all scenes, directions, and collect the ordered start units of the beats
    List<Integer> startUnits = new ArrayList<>();
    for (int sceneIndex = 0; sceneIndex < scenes.size(); sceneIndex++) {
      JsonNode scene = object(scenes.get(sceneIndex), "scene " + sceneIndex);
      requiredText(scene, "title", "scene " + sceneIndex + " title");
      JsonNode beats = firstArray(scene, "visual_beats");
      if (beats == null || beats.isEmpty()) {
        throw invalid("scene " + sceneIndex + " must contain visual beats");
      }
      for (int beatIndex = 0; beatIndex < beats.size(); beatIndex++) {
        JsonNode beat = object(beats.get(beatIndex), "scene " + sceneIndex + " beat " + beatIndex);
        startUnits.add(validateBeat(beat, "scene " + sceneIndex + " beat " + beatIndex));
      }
    }

    // Deterministically resolve all unit references before performing any database writes
    SourceAnchorResolver.SourceUnits sourceUnits =
        sourceAnchorResolver.units(job.getSourceText(), job.getSourceHash());
    List<SourceAnchorResolver.ResolvedSourceAnchor> resolvedAnchors =
        sourceAnchorResolver.resolveBeats(sourceUnits, startUnits);

    ChapterCanon parsedCanon = parseCanon(root.get("canon"));
    List<List<PreparedAudioCue>> audioPlans = new ArrayList<>();
    int audioBeatIndex = 0;
    for (JsonNode scene : scenes) {
      for (JsonNode beat : firstArray(scene, "visual_beats")) {
        var beatAnchor = resolvedAnchors.get(audioBeatIndex++);
        audioPlans.add(
            fillNarrationGaps(
                sourceUnits,
                beatAnchor,
                prepareAudioCues(sourceUnits, beat, beatAnchor, parsedCanon)));
      }
    }

    // Materialize Hook Plan if present
    if (hookPlanMapper != null && root.has("hook_plan")) {
      JsonNode hookNode = root.get("hook_plan");
      if (hookNode != null && hookNode.isObject()) {
        HookPlanRow hookRow = new HookPlanRow();
        hookRow.setChapterId(job.getChapterId());
        hookRow.setPromise(text(hookNode, "promise", ""));
        hookRow.setConflict(text(hookNode, "conflict", ""));
        hookRow.setCuriosityQuestion(text(hookNode, "curiosity_question", ""));
        hookRow.setVisualHook(text(hookNode, "visual_hook", ""));
        hookRow.setDialogueHook(text(hookNode, "dialogue_hook", ""));
        hookRow.setWithheldInformation(text(hookNode, "withheld_information", ""));
        hookRow.setCreatedAt(now);
        hookRow.setUpdatedAt(now);
        hookPlanMapper.insert(hookRow);
      }
    }

    // Materialize Retention Map and Attention Events if present
    if (retentionMapMapper != null && root.has("retention_map")) {
      JsonNode retNode = root.get("retention_map");
      if (retNode != null && retNode.isObject()) {
        RetentionMapRow retRow = new RetentionMapRow();
        retRow.setChapterId(job.getChapterId());
        retRow.setTensionCurveJson(
            retNode.has("tension_curve") ? retNode.get("tension_curve").toString() : "[]");
        retRow.setOpenQuestionsJson(
            retNode.has("open_questions") ? retNode.get("open_questions").toString() : "[]");
        retRow.setResolvedQuestionsJson(
            retNode.has("resolved_questions")
                ? retNode.get("resolved_questions").toString()
                : "[]");
        retRow.setPacingWarningsJson(
            retNode.has("pacing_warnings") ? retNode.get("pacing_warnings").toString() : "[]");
        retRow.setCreatedAt(now);
        retRow.setUpdatedAt(now);
        UUID mapId = retentionMapMapper.insert(retRow);

        if (attentionEventMapper != null) {
          JsonNode eventsNode = firstArray(retNode, "attention_events");
          if (eventsNode != null && eventsNode.isArray()) {
            List<AttentionEventRow> eventRows = new ArrayList<>();
            for (JsonNode ev : eventsNode) {
              AttentionEventRow evRow = new AttentionEventRow();
              evRow.setRetentionMapId(mapId);
              evRow.setEventType(text(ev, "event_type", "INFO"));
              evRow.setTimeOffsetMs(
                  ev.has("time_offset_ms") ? ev.get("time_offset_ms").asLong(0) : 0L);
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

    // Pass 2: Materialize scenes, visual beats, shots, and character bindings with validated UTF-16
    // ranges
    int globalBeatIndex = 0;
    for (int sceneIndex = 0; sceneIndex < scenes.size(); sceneIndex++) {
      JsonNode scene = scenes.get(sceneIndex);
      String title = requiredText(scene, "title", "scene " + sceneIndex + " title");
      String narration = text(scene, "narration", "");
      JsonNode beats = firstArray(scene, "visual_beats");

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

      String locationRef = text(scene, "location_ai_name", null);
      if (locationRef != null && !locationRef.isBlank()) {
        sceneRow.setLocationText(locationRef);
        if (reconciled != null) {
          sceneRow.setProjectLocationId(reconciled.findLocationId(locationRef));
        }
      }
      UUID sceneId = storyboardMapper.insertScene(sceneRow);

      // Materialize scene_characters
      if (canonMapper != null && reconciled != null) {
        JsonNode sceneCharacters = firstArray(scene, "character_ai_names");
        if (sceneCharacters != null && sceneCharacters.isArray()) {
          int charOrder = 0;
          Set<UUID> addedSceneChars = new HashSet<>();
          for (JsonNode charNode : sceneCharacters) {
            String charRef =
                charNode.isTextual() ? charNode.asText() : text(charNode, "ai_name", null);
            if (charRef != null && !charRef.isBlank()) {
              UUID projectCharId = reconciled.findCharacterId(charRef);
              if (projectCharId == null) {
                LOG.warn(
                    "Scene {} refers to character '{}' that is not in the chapter canon",
                    sceneIndex,
                    charRef);
              }
              if (projectCharId != null && addedSceneChars.add(projectCharId)) {
                canonMapper.insertSceneCharacter(sceneId, charOrder++, projectCharId);
              }
            }
          }
        }
      }

      for (int beatIndex = 0; beatIndex < beats.size(); beatIndex++) {
        JsonNode beat = beats.get(beatIndex);
        JsonNode direction = firstObject(beat, "visual_direction");
        var resolvedAnchor = resolvedAnchors.get(globalBeatIndex++);

        StoryBeatRow storyBeatRow = new StoryBeatRow();
        storyBeatRow.setSceneId(sceneId);
        storyBeatRow.setOrderIndex(beatIndex);
        storyBeatRow.setSourceStart(resolvedAnchor.textStart());
        storyBeatRow.setSourceEnd(resolvedAnchor.textEnd());
        storyBeatRow.setSourceAnchorJson(resolvedAnchor.sourceAnchorJson());
        storyBeatRow.setPurpose(dramaticIntent(beat));
        storyBeatRow.setSummary(requiredText(beat, "title", "visual beat title"));
        storyBeatRow.setImportance(text(beat, "importance", "NORMAL"));
        storyBeatRow.setStoryFunctionsJson("[]");
        storyBeatRow.setReviewStatus("NEEDS_REVIEW");
        storyBeatRow.setCreatedAt(now);
        storyBeatRow.setUpdatedAt(now);
        UUID storyBeatId = storyboardMapper.insertStoryBeat(storyBeatRow);

        for (PreparedAudioCue cue : audioPlans.get(globalBeatIndex - 1)) {
          UUID speakerId =
              cue.speakerName() != null && reconciled != null
                  ? reconciled.findCharacterId(cue.speakerName())
                  : null;
          if (cue.speakerName() != null && speakerId == null) {
            throw invalid("audio cue speaker could not be resolved to a participating character");
          }
          AudioCueRow cueRow = new AudioCueRow();
          cueRow.setStoryBeatId(storyBeatId);
          cueRow.setOrderIndex(cue.orderIndex());
          cueRow.setCueType(cue.cueType());
          cueRow.setSpeakerProjectCharacterId(speakerId);
          cueRow.setSourceStart(cue.sourceStart());
          cueRow.setSourceEnd(cue.sourceEnd());
          cueRow.setSourceAnchorJson(cue.sourceAnchorJson());
          cueRow.setAdaptationAction(cue.adaptationAction());
          cueRow.setAdaptedText(cue.adaptedText());
          cueRow.setDeliveryHint(cue.deliveryHint());
          cueRow.setStatus("DRAFT");
          cueRow.setCreatedAt(now);
          cueRow.setUpdatedAt(now);
          storyboardMapper.insertAudioCue(cueRow);
        }

        VisualBeatRow beatRow = new VisualBeatRow();
        beatRow.setSceneId(sceneId);
        beatRow.setStoryBeatId(storyBeatId);
        beatRow.setOrderIndex(beatIndex);
        beatRow.setTitle(requiredText(beat, "title", "visual beat title"));
        beatRow.setVisualIntent(requiredText(beat, "visual_intent", "visual beat visual_intent"));
        beatRow.setVisualDirectionJson(direction.toString());
        beatRow.setDramaticIntent(dramaticIntent(beat));
        beatRow.setRetentionRole(text(beat, "retention_role", null));
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
          JsonNode beatCharacters = firstArray(beat, "character_ai_names");
          if (beatCharacters != null && beatCharacters.isArray()) {
            Set<UUID> addedBeatChars = new HashSet<>();
            for (JsonNode charNode : beatCharacters) {
              String charRef =
                  charNode.isTextual() ? charNode.asText() : text(charNode, "ai_name", null);
              String role = charNode.isObject() ? text(charNode, "role", "SECONDARY") : "SECONDARY";
              if (charRef != null && !charRef.isBlank()) {
                UUID projectCharId = reconciled.findCharacterId(charRef);
                if (projectCharId == null) {
                  LOG.warn(
                      "Scene {} beat {} refers to character '{}' that is not in the chapter canon",
                      sceneIndex,
                      beatIndex,
                      charRef);
                }
                if (projectCharId != null && addedBeatChars.add(projectCharId)) {
                  canonMapper.insertVisualBeatCharacter(beatId, projectCharId, role);
                }
              }
            }
          }
        }

        // Materialize shot sequences and shots
        JsonNode shotsNode = firstArray(beat, "shots");
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
            shotRow.setNarrativePurpose(text(shotItem, "narrative_purpose", ""));
            shotRow.setRetentionRole(text(shotItem, "retention_role", null));
            shotRow.setSubjectsJson(
                shotItem.has("subjects") ? shotItem.get("subjects").toString() : "[]");
            shotRow.setLocationRef(text(shotItem, "location_ref", null));
            shotRow.setStartStateJson(
                shotItem.has("start_state") ? shotItem.get("start_state").toString() : "{}");
            shotRow.setActionJson(objectOrWrapped(shotItem, "action", "action"));
            shotRow.setEndStateJson(
                shotItem.has("end_state") ? shotItem.get("end_state").toString() : "{}");
            shotRow.setCompositionJson(objectOrWrapped(shotItem, "composition", "composition"));
            shotRow.setCameraJson(objectOrWrapped(shotItem, "camera", "camera"));
            shotRow.setSubjectMotionJson(
                objectOrWrapped(shotItem, "subject_motion", "subjectMotion"));
            shotRow.setCameraMotionJson(objectOrWrapped(shotItem, "camera_motion", "cameraMotion"));
            shotRow.setEnvironmentMotionJson(
                objectOrWrapped(shotItem, "environment_motion", "environmentMotion"));
            shotRow.setTargetDurationMs(
                shotItem.has("target_duration_ms")
                    ? shotItem.get("target_duration_ms").asLong(estimateDurationMs(resolvedAnchor))
                    : estimateDurationMs(resolvedAnchor));
            shotRow.setGenerationStrategy(text(shotItem, "generation_strategy", "TEXT_TO_VIDEO"));
            shotRow.setQualityProfile(text(shotItem, "quality_profile", "720p_24fps_standard"));
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
              wrapText(
                  "action", beatRow.getVisualIntent() != null ? beatRow.getVisualIntent() : ""));
          defaultShot.setEndStateJson("{}");
          defaultShot.setCompositionJson("{}");
          defaultShot.setCameraJson("{}");
          defaultShot.setSubjectMotionJson("{}");
          defaultShot.setCameraMotionJson("{}");
          defaultShot.setEnvironmentMotionJson("{}");
          defaultShot.setTargetDurationMs(estimateDurationMs(resolvedAnchor));
          defaultShot.setGenerationStrategy("TEXT_TO_VIDEO");
          defaultShot.setQualityProfile("720p_24fps_standard");
          defaultShot.setStatus("PLANNED");
          defaultShot.setCreatedAt(now);
          defaultShot.setUpdatedAt(now);
          shotMapper.insert(defaultShot);
        }
      }
    }
    chapter.setCurrentStoryboardRevisionId(job.getStoryboardRevisionId());
    if (chapterMapper.update(chapter) == 0) {
      throw invalid("analysis chapter changed before storyboard activation");
    }
  }

  public enum Severity {
    /** The result cannot be materialized until this is fixed. */
    ERROR,
    /** The result is accepted; the finding is reported so it can be improved. */
    WARNING
  }

  public record Violation(Severity severity, String path, String message) {}

  private static Violation error(String path, String message) {
    return new Violation(Severity.ERROR, path, message);
  }

  /** Structure of one visual beat; returns its {@code start_unit}. */
  private static int validateBeat(JsonNode beat, String context) {
    requiredText(beat, "title", context + " title");
    requiredText(beat, "visual_intent", context + " visual_intent");
    int start = unitIndex(beat, "start_unit", context);
    JsonNode direction = firstObject(beat, "visual_direction");
    if (direction == null) throw invalid(context + " is missing visual_direction");
    for (String field : REQUIRED_DIRECTION_FIELDS) {
      requiredValue(direction, field, context + " visual_direction." + field);
    }
    return start;
  }

  /**
   * Checks a result without writing anything and reports every problem it can find, so the model
   * can repair them in one pass. {@code windowFirst}/{@code windowLast} (inclusive unit indexes,
   * {@code -1} for the whole chapter) bound a partial result produced for one window of a long
   * chapter.
   */
  public List<Violation> validate(
      GenerationJob job, byte[] payload, int windowFirst, int windowLast) {
    JsonNode root;
    try {
      root = parse(payload);
    } catch (IllegalArgumentException exception) {
      return List.of(error("$", exception.getMessage()));
    }
    JsonNode scenes = root.get("scenes");
    if (scenes == null || !scenes.isArray() || scenes.isEmpty()) {
      return List.of(error("scenes", "analysis output must contain at least one scene"));
    }
    if (job.getSourceText() == null || job.getSourceText().isBlank()) {
      return List.of(error("$", "analysis job source text is missing"));
    }
    SourceAnchorResolver.SourceUnits source =
        sourceAnchorResolver.units(job.getSourceText(), job.getSourceHash());
    int unitCount = source.units().size();
    int low = Math.max(windowFirst, 0);
    int high = windowLast < 0 ? unitCount - 1 : Math.min(windowLast, unitCount - 1);
    if (low > high) return List.of(error("$", "unit window lies outside the chapter"));

    List<Violation> found = new ArrayList<>();
    List<JsonNode> beats = new ArrayList<>();
    List<String> paths = new ArrayList<>();
    List<Integer> starts = new ArrayList<>();
    for (int sceneIndex = 0; sceneIndex < scenes.size(); sceneIndex++) {
      String scenePath = "scenes[" + sceneIndex + "]";
      JsonNode scene = scenes.get(sceneIndex);
      try {
        object(scene, scenePath);
        requiredText(scene, "title", scenePath + " title");
      } catch (IllegalArgumentException exception) {
        found.add(error(scenePath, exception.getMessage()));
        continue;
      }
      JsonNode sceneBeats = firstArray(scene, "visual_beats");
      if (sceneBeats == null || sceneBeats.isEmpty()) {
        found.add(error(scenePath, "scene must contain visual_beats"));
        continue;
      }
      for (int beatIndex = 0; beatIndex < sceneBeats.size(); beatIndex++) {
        String path = scenePath + ".visual_beats[" + beatIndex + "]";
        try {
          JsonNode beat = object(sceneBeats.get(beatIndex), path);
          starts.add(validateBeat(beat, path));
          beats.add(beat);
          paths.add(path);
        } catch (IllegalArgumentException exception) {
          found.add(error(path, exception.getMessage()));
        }
      }
    }
    if (!found.isEmpty()) return found;

    for (int index = 0; index < starts.size(); index++) {
      int start = starts.get(index);
      if (start < low || start > high) {
        found.add(
            error(
                paths.get(index),
                "start_unit " + start + " is outside the allowed units " + low + ".." + high));
      } else if (index > 0 && start <= starts.get(index - 1)) {
        found.add(
            error(
                paths.get(index),
                "start_unit "
                    + start
                    + " must be greater than the previous beat's "
                    + starts.get(index - 1)));
      } else if (index == 0 && start != low) {
        found.add(
            error(paths.get(index), "the first beat must start at unit " + low + ", not " + start));
      }
    }
    if (!found.isEmpty()) return found;

    ChapterCanon canon = parseCanon(root.get("canon"));
    for (int index = 0; index < beats.size(); index++) {
      int first = index == 0 ? low : starts.get(index);
      int last = index + 1 < starts.size() ? starts.get(index + 1) - 1 : high;
      var anchor = sourceAnchorResolver.range(source, first, last);
      int characters = 0;
      for (int unit = first; unit <= last; unit++)
        characters += source.units().get(unit).text().length();
      if (characters > BEAT_MAX_CHARS) {
        found.add(
            new Violation(
                Severity.WARNING,
                paths.get(index),
                "beat covers "
                    + characters
                    + " characters (limit "
                    + BEAT_MAX_CHARS
                    + "); start a new beat earlier"));
      }
      try {
        List<PreparedAudioCue> cues = prepareAudioCues(source, beats.get(index), anchor, canon);
        boolean[] covered = new boolean[last - first + 1];
        for (PreparedAudioCue cue : cues) {
          for (int unit = cue.firstUnit(); unit <= cue.lastUnit(); unit++)
            covered[unit - first] = true;
        }
        for (int unit = first; unit <= last; unit++) {
          if (covered[unit - first]) continue;
          int runStart = unit;
          while (unit + 1 <= last && !covered[unit + 1 - first]) unit++;
          found.add(
              new Violation(
                  Severity.WARNING,
                  paths.get(index) + ".audio_cues",
                  "units "
                      + runStart
                      + ".."
                      + unit
                      + " are not narrated by any cue; exact narration will be added"));
        }
      } catch (IllegalArgumentException exception) {
        found.add(error(paths.get(index) + ".audio_cues", exception.getMessage()));
      }
    }
    return found;
  }

  /** Source text is never dropped silently: units no cue narrates become exact narrator cues. */
  private List<PreparedAudioCue> fillNarrationGaps(
      SourceAnchorResolver.SourceUnits source,
      SourceAnchorResolver.ResolvedSourceAnchor beat,
      List<PreparedAudioCue> cues) {
    int first = beat.firstUnit();
    int last = beat.lastUnit();
    boolean[] covered = new boolean[last - first + 1];
    for (PreparedAudioCue cue : cues) {
      for (int unit = cue.firstUnit(); unit <= cue.lastUnit(); unit++) covered[unit - first] = true;
    }
    List<PreparedAudioCue> all = new ArrayList<>(cues);
    for (int unit = first; unit <= last; unit++) {
      if (covered[unit - first]) continue;
      int runStart = unit;
      while (unit + 1 <= last && !covered[unit + 1 - first]) unit++;
      var range = sourceAnchorResolver.range(source, runStart, unit);
      all.add(
          new PreparedAudioCue(
              -1,
              "NARRATOR",
              null,
              range.textStart(),
              range.textEnd(),
              range.sourceAnchorJson(),
              "KEEP_EXACT",
              source.normalizedSource().substring(range.textStart(), range.textEnd()),
              null,
              runStart,
              unit));
    }
    if (all.size() == cues.size()) return cues;
    all.sort(
        java.util.Comparator.comparingInt(PreparedAudioCue::firstUnit)
            .thenComparingInt(PreparedAudioCue::lastUnit));
    List<PreparedAudioCue> ordered = new ArrayList<>(all.size());
    for (int index = 0; index < all.size(); index++) {
      PreparedAudioCue cue = all.get(index);
      ordered.add(
          new PreparedAudioCue(
              index,
              cue.cueType(),
              cue.speakerName(),
              cue.sourceStart(),
              cue.sourceEnd(),
              cue.sourceAnchorJson(),
              cue.adaptationAction(),
              cue.adaptedText(),
              cue.deliveryHint(),
              cue.firstUnit(),
              cue.lastUnit()));
    }
    return List.copyOf(ordered);
  }

  /**
   * Provisional shot length from the narrated characters; alignment replaces it once audio exists.
   */
  private static long estimateDurationMs(SourceAnchorResolver.ResolvedSourceAnchor anchor) {
    long estimate = (long) (anchor.textEnd() - anchor.textStart()) * MS_PER_CHAR;
    return Math.max(MIN_SHOT_MS, Math.min(MAX_SHOT_MS, estimate));
  }

  private static String dramaticIntent(JsonNode beat) {
    String value = text(beat, "dramatic_intent", null);
    if (value != null) {
      String normalized = value.trim().toUpperCase(Locale.ROOT);
      for (DramaticIntent intent : DramaticIntent.values()) {
        if (intent.name().equals(normalized)) return normalized;
      }
    }
    return DramaticIntent.SETUP.name();
  }

  private record PreparedAudioCue(
      int orderIndex,
      String cueType,
      String speakerName,
      int sourceStart,
      int sourceEnd,
      String sourceAnchorJson,
      String adaptationAction,
      String adaptedText,
      String deliveryHint,
      int firstUnit,
      int lastUnit) {}

  private List<PreparedAudioCue> prepareAudioCues(
      SourceAnchorResolver.SourceUnits source,
      JsonNode beat,
      SourceAnchorResolver.ResolvedSourceAnchor parent,
      ChapterCanon canon) {
    JsonNode cues = firstArray(beat, "audio_cues");
    if (cues == null) {
      if (beat.has("audio_cues")) {
        throw invalid("audio_cues must be an array");
      }
      return List.of();
    }
    if (cues.isEmpty()) return List.of();
    Set<String> names = new HashSet<>();
    for (var character : canon.characters()) {
      names.add(character.aiName().trim().toLowerCase(Locale.ROOT));
      names.add(character.canonicalName().trim().toLowerCase(Locale.ROOT));
      for (String alias : character.aliases()) names.add(alias.trim().toLowerCase(Locale.ROOT));
    }
    Set<String> fields =
        Set.of(
            "cue_type",
            "speaker_ai_name",
            "start_unit",
            "end_unit",
            "adaptation_action",
            "adapted_text",
            "delivery_hint");
    List<SourceAnchorResolver.ResolvedSourceAnchor> ranges = new ArrayList<>();
    List<String> actions = new ArrayList<>();
    for (JsonNode rawCue : cues) {
      JsonNode cue = object(rawCue, "audio cue");
      long knownFields = fields.stream().filter(cue::has).count();
      if (knownFields != cue.size()) throw invalid("audio cue contains unknown fields");
      String type = requiredText(cue, "cue_type", "audio cue type");
      if (!Set.of("NARRATOR", "DIALOGUE", "INNER_MONOLOGUE", "SYSTEM").contains(type)) {
        throw invalid("unsupported audio cue type");
      }
      String action = requiredText(cue, "adaptation_action", "audio cue adaptation_action");
      if (!Set.of("KEEP_EXACT", "LIGHT_EDIT", "COMPRESS", "VISUAL_PRIMARY").contains(action)) {
        throw invalid("unsupported audio cue adaptation action");
      }
      String speaker = text(cue, "speaker_ai_name", null);
      for (String optional : List.of("speaker_ai_name", "delivery_hint")) {
        if (cue.has(optional) && !cue.get(optional).isNull() && !cue.get(optional).isTextual()) {
          throw invalid("audio cue " + optional + " must be text");
        }
      }
      if (("DIALOGUE".equals(type) || "INNER_MONOLOGUE".equals(type))
          && (speaker == null || speaker.isBlank())) {
        throw invalid("spoken character cue requires a speaker");
      }
      if (speaker != null && !names.contains(speaker.trim().toLowerCase(Locale.ROOT))) {
        throw invalid("audio cue speaker is not present in the chapter canon");
      }
      String where = "audio cue " + ranges.size();
      int first = unitIndex(cue, "start_unit", where);
      int last = unitIndex(cue, "end_unit", where);
      if (last < first) throw invalid(where + " end_unit must not be before start_unit");
      if (first < parent.firstUnit() || last > parent.lastUnit()) {
        throw invalid(
            where
                + " units "
                + first
                + ".."
                + last
                + " lie outside its visual beat's units "
                + parent.firstUnit()
                + ".."
                + parent.lastUnit());
      }
      if (!ranges.isEmpty()) {
        var previous = ranges.get(ranges.size() - 1);
        if (first < previous.firstUnit() || last < previous.lastUnit()) {
          throw invalid(where + " must come after the previous audio cue");
        }
        // Two cues may share a unit only to split it (for example dialogue and its tag), never to
        // repeat exact text.
        boolean shares = first <= previous.lastUnit();
        if (shares
            && ("KEEP_EXACT".equals(action)
                || "KEEP_EXACT".equals(actions.get(actions.size() - 1)))) {
          throw invalid(
              where + " repeats units of the previous audio cue that keeps its text exact");
        }
      }
      ranges.add(sourceAnchorResolver.range(source, first, last));
      actions.add(action);
    }
    List<PreparedAudioCue> prepared = new ArrayList<>();
    for (int index = 0; index < cues.size(); index++) {
      JsonNode cue = cues.get(index);
      var range = ranges.get(index);
      String action = actions.get(index);
      // The source text is authoritative for KEEP_EXACT; the model's copy is never trusted or
      // compared.
      String adapted =
          "KEEP_EXACT".equals(action)
              ? source.normalizedSource().substring(range.textStart(), range.textEnd())
              : requiredText(cue, "adapted_text", "audio cue adapted_text");
      prepared.add(
          new PreparedAudioCue(
              index,
              cue.get("cue_type").asText(),
              text(cue, "speaker_ai_name", null),
              range.textStart(),
              range.textEnd(),
              range.sourceAnchorJson(),
              action,
              adapted,
              text(cue, "delivery_hint", null),
              range.firstUnit(),
              range.lastUnit()));
    }
    return List.copyOf(prepared);
  }

  /** A non-negative integer unit index; text, fractions and out-of-int values are rejected. */
  private static int unitIndex(JsonNode node, String field, String context) {
    JsonNode value = node.get(field);
    if (value == null
        || !value.isIntegralNumber()
        || !value.canConvertToInt()
        || value.asInt() < 0) {
      throw invalid(context + " " + field + " must be a non-negative integer unit index");
    }
    return value.asInt();
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

  /**
   * Keeps an object as is and wraps a plain string as {key: text}; never builds JSON by
   * concatenation.
   */
  private static String objectOrWrapped(JsonNode item, String field, String wrapKey) {
    JsonNode value = item.get(field);
    if (value == null) return "{}";
    if (value.isObject()) return value.toString();
    return wrapText(wrapKey, value.asText());
  }

  private static String wrapText(String key, String text) {
    var node = JSON.createObjectNode();
    node.put(key, text);
    return node.toString();
  }

  private static IllegalArgumentException invalid(String message) {
    return new IllegalArgumentException(message);
  }

  private static IllegalArgumentException invalid(String message, Throwable cause) {
    return new IllegalArgumentException(message, cause);
  }
}
