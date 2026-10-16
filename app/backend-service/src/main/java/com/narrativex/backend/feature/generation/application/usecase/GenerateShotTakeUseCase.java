package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.configuration.NarrativeXLimitsProperties;
import com.narrativex.backend.feature.character.application.port.in.SpeakerVoiceAccess;
import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.api.response.TakeResponse;
import com.narrativex.backend.feature.generation.application.command.GenerateShotTakeCommand;
import com.narrativex.backend.feature.generation.application.model.TakeInputSnapshot;
import com.narrativex.backend.feature.generation.application.model.compute.CanonicalFingerprintCalculator;
import com.narrativex.backend.feature.generation.application.model.compute.ModelRefDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskArtifactsDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskConstraintsDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskDescriptorDto;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettings;
import com.narrativex.backend.feature.generation.application.port.in.PromptSettingsAccess;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationOutboxRepository;
import com.narrativex.backend.feature.generation.application.port.out.OperationPlanRepository;
import com.narrativex.backend.feature.generation.application.port.out.ShotLocationContextRepository;
import com.narrativex.backend.feature.generation.application.port.out.ShotLocationContextRepository.ShotLocationContext;
import com.narrativex.backend.feature.generation.application.port.out.StageAttemptRepository;
import com.narrativex.backend.feature.generation.application.port.out.TakeRepository;
import com.narrativex.backend.feature.generation.application.port.out.VideoGenerationCatalog;
import com.narrativex.backend.feature.generation.application.service.ComputeAttemptIdentity;
import com.narrativex.backend.feature.generation.application.service.GenerationPreflightEvaluator;
import com.narrativex.backend.feature.generation.application.service.NativeVideoInputMapper;
import com.narrativex.backend.feature.generation.application.service.NativeVideoInputMapper.NativeDialogueLine;
import com.narrativex.backend.feature.generation.application.service.NativeVideoInputMapper.NativeVideoInputs;
import com.narrativex.backend.feature.generation.application.service.NativeVideoInputMapper.NativeVoiceDescription;
import com.narrativex.backend.feature.generation.application.service.VideoLocationContext;
import com.narrativex.backend.feature.generation.application.service.VideoPromptCompiler;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.aggregate.OperationPlan;
import com.narrativex.backend.feature.generation.domain.entity.StageAttempt;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardShotAccess;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

@Service
@RequiredArgsConstructor
public class GenerateShotTakeUseCase {
  private static final JsonMapper JSON = JsonMapper.builder().build();
  private static final String STAGE = "SHOT_VIDEO_GENERATE";
  private final StoryboardProductionAccess storyboardAccess;
  private final StoryboardShotAccess shotAccess;
  private final SpeakerVoiceAccess speakerVoiceAccess;
  private final TakeRepository takeRepository;
  private final GenerationJobRepository generationJobRepository;
  private final OperationPlanRepository operationPlanRepository;
  private final StageAttemptRepository stageAttemptRepository;
  private final GenerationOutboxRepository outboxRepository;
  private final VideoGenerationCatalog catalog;
  private final VideoPromptCompiler promptCompiler;
  private final NativeVideoInputMapper nativeVideoInputMapper;
  private final NarrativeXLimitsProperties limits;
  private final PromptSettingsAccess promptSettingsAccess;
  private final ShotLocationContextRepository shotLocationContexts;

  @Transactional
  public TakeResponse execute(GenerateShotTakeCommand command) {
    return admit(command, null, null);
  }

  /**
   * Admits a batch leaf from inputs frozen at batch admission. The frozen prompts and prompt
   * provenance are reused verbatim; the current prompt configuration is never consulted.
   */
  @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NESTED)
  public TakeResponse executeFrozen(
      GenerateShotTakeCommand command, String frozenFingerprint, String frozenInputJson) {
    return admit(
        command,
        Objects.requireNonNull(frozenFingerprint),
        Objects.requireNonNull(frozenInputJson));
  }

  @Transactional
  public FrozenShot freeze(GenerateShotTakeCommand command) {
    return freeze(command, promptSettingsAccess.current());
  }

  /** Freezes one shot against the prompt settings the caller resolved once for the batch. */
  @Transactional
  public FrozenShot freeze(GenerateShotTakeCommand command, PromptSettings settings) {
    return freeze(command, settings, null);
  }

  /**
   * Batch variant: Location contexts for every Shot of the batch come from one {@link
   * #loadLocationContexts} call instead of one query per Shot. A Shot missing from the map is
   * resolved individually.
   */
  @Transactional
  public FrozenShot freeze(
      GenerateShotTakeCommand command,
      PromptSettings settings,
      Map<UUID, ShotLocationContext> preloadedLocations) {
    var prepared =
        prepare(
            command, preloadedLocations == null ? null : preloadedLocations.get(command.shotId()));
    bindPrompt(prepared, compilePrompt(prepared.shot(), settings, prepared.location()));
    return new FrozenShot(
        prepared.requestFingerprint(), JSON.writeValueAsString(prepared.semantics()));
  }

  public record FrozenShot(String requestFingerprint, String inputJson) {}

  /** One bounded query for the Location and preceding-Shot context of every given Shot. */
  public Map<UUID, ShotLocationContext> loadLocationContexts(UUID projectId, List<UUID> shotIds) {
    return shotLocationContexts.findForShots(projectId, shotIds);
  }

  private record Prepared(
      StoryboardShotAccess.ShotView shot,
      GenerationStrategy strategy,
      String audioMode,
      Map<String, Object> context,
      Map<String, Object> inputs,
      Map<String, Object> semantics,
      List<TakeInputSnapshot.Reference> references,
      String requestFingerprint,
      VideoLocationContext location) {}

  private TakeResponse admit(
      GenerateShotTakeCommand command, String frozenFingerprint, String frozenInputJson) {
    if (command.idempotencyKey() == null
        || command.idempotencyKey().isBlank()
        || command.idempotencyKey().length() > 200) {
      throw new IllegalArgumentException("Idempotency-Key must contain 1 to 200 characters");
    }
    if (command.seed() != null && command.seed() <= 0) {
      throw new IllegalArgumentException("Seed must be positive");
    }
    String key =
        "shot-take:"
            + command.projectId()
            + ":"
            + command.shotId()
            + ":"
            + command.idempotencyKey();
    generationJobRepository.acquireIdempotencyLock(key);
    // Settings-independent identity: replay and frozen-batch checks never consult the current
    // prompt configuration, so a later Save cannot turn a replay into a conflict.
    var prepared = prepare(command, null);
    String requestFingerprint = prepared.requestFingerprint();
    PromptInput frozenPrompt = frozenInputJson == null ? null : frozenPrompt(frozenInputJson);
    if (frozenFingerprint != null
        && !frozenFingerprint.equals(requestFingerprint)
        && !frozenFingerprint.equals(locationFreeRequestFingerprint(prepared))
        && !frozenFingerprint.equals(legacyRequestFingerprint(prepared, frozenPrompt))) {
      throw new ResourceConflictException(
          "Frozen batch shot inputs changed; create a new batch after reconciliation");
    }
    var existing = generationJobRepository.findByIdempotencyKey(key);
    if (existing.isPresent()) {
      var take =
          takeRepository
              .findByGenerationJobId(existing.get().getId())
              .orElseThrow(() -> new IllegalStateException("Admitted job has no take"));
      var saved = JSON.readValue(take.inputSnapshotJson(), TakeInputSnapshot.class);
      if (!requestFingerprint.equals(saved.requestFingerprint())
          && !locationFreeRequestFingerprint(prepared).equals(saved.requestFingerprint())
          && !isLegacyReplay(prepared, saved)) {
        throw new ResourceConflictException("Idempotency-Key reused with different shot inputs");
      }
      return response(take, existing.get().getJobId());
    }
    bindPrompt(
        prepared,
        frozenPrompt != null
            ? frozenPrompt
            : compilePrompt(prepared.shot(), promptSettingsAccess.current(), prepared.location()));
    var shot = prepared.shot();
    var strategy = prepared.strategy();
    var audioMode = prepared.audioMode();
    var context = prepared.context();
    var inputs = prepared.inputs();
    var semantics = prepared.semantics();
    var references = prepared.references();
    var previousTakes = takeRepository.findByShotId(command.shotId());
    for (var previous : previousTakes) {
      if (previous.generationJobId() == null) continue;
      var previousJob = generationJobRepository.findById(previous.generationJobId()).orElseThrow();
      if (previousJob.getStatus()
              == com.narrativex.backend.feature.generation.domain.enums.JobStatus.UNKNOWN
          || previousJob.getStatus()
              == com.narrativex.backend.feature.generation.domain.enums.JobStatus.RECONCILING) {
        throw new ResourceConflictException(
            "An UNKNOWN shot attempt must be reconciled before regeneration");
      }
    }
    if (command.retryFromTakeId() != null) {
      var previous =
          takeRepository
              .findById(command.retryFromTakeId())
              .filter(t -> command.shotId().equals(t.shotId()))
              .orElseThrow(
                  () -> new DomainValidationException("Retry take must belong to this shot"));
      if (previous.generationJobId() != null) {
        var job = generationJobRepository.findById(previous.generationJobId()).orElseThrow();
        if (!Set.of(
                com.narrativex.backend.feature.generation.domain.enums.JobStatus.COMPLETED,
                com.narrativex.backend.feature.generation.domain.enums.JobStatus.FAILED,
                com.narrativex.backend.feature.generation.domain.enums.JobStatus.CANCELED)
            .contains(job.getStatus())) {
          throw new ResourceConflictException("Retry requires a reconciled terminal take job");
        }
      }
    }
    generationJobRepository.acquireAnalysisCapacityLock();
    if (generationJobRepository.countActiveJobs() >= limits.getMaxConcurrentExpensiveJobs()) {
      throw new GenerationAdmissionDeniedException(
          "CAPACITY_LIMIT", "Generation queue admission limit exhausted");
    }
    int attempt =
        previousTakes.stream().mapToInt(TakeRepository.TakeRecord::attemptNumber).max().orElse(0)
            + 1;
    long seed =
        command.seed() == null
            ? 1L + Integer.toUnsignedLong(Objects.hash(key, attempt))
            : command.seed();
    inputs.put("seed", seed);
    semantics.put("seed", seed);
    String inputFingerprint =
        fingerprint(semantics, catalog.defaultProvider(), catalog.defaultModel());
    var snapshot =
        new TakeInputSnapshot(
            1,
            command.shotId(),
            attempt,
            requestFingerprint,
            inputFingerprint,
            catalog.defaultProvider(),
            catalog.defaultModel(),
            catalog.modelRevision(),
            catalog.workflowRevision(),
            shot.qualityProfile(),
            audioMode,
            seed,
            Instant.now().plusSeconds(1200),
            context,
            inputs,
            references);
    var preparedJob =
        GenerationJob.createShotVideoGeneration(
                command.projectId(),
                UUID.fromString(context.get("storyVersionId").toString()),
                UUID.fromString(context.get("chapterId").toString()),
                JSON.writeValueAsString(snapshot),
                key)
            .toBuilder()
            .chapterRowVersion(((Number) context.get("chapterRowVersion")).longValue())
            .sourceHash(context.get("sourceHash").toString())
            .sourceLanguage(context.get("sourceLanguage").toString())
            .storyboardRevisionId(UUID.fromString(context.get("storyboardRevisionId").toString()))
            .build();
    var job =
        generationJobRepository.save(
            preparedJob.toBuilder()
                .computeAttemptId(
                    ComputeAttemptIdentity.forJob(preparedJob.getJobId(), preparedJob.getType()))
                .build());
    var plan =
        operationPlanRepository.save(
            OperationPlan.forShot(command.projectId(), command.shotId(), inputFingerprint));
    plan = operationPlanRepository.save(plan.withGenerationJobId(job.getId()));
    var take =
        takeRepository.createPending(
            command.shotId(),
            attempt,
            snapshot.provider(),
            snapshot.model(),
            strategy,
            job.getId(),
            job.getJobId(),
            job.getComputeAttemptId(),
            plan.getId(),
            JSON.writeValueAsString(snapshot),
            inputFingerprint);
    stageAttemptRepository.create(StageAttempt.create(job.getId(), STAGE, attempt));
    outboxRepository.enqueue(job);
    return response(take, job.getJobId());
  }

  private Prepared prepare(GenerateShotTakeCommand command, ShotLocationContext preloaded) {
    String contextJson =
        storyboardAccess.findAdmissionContextLocked(command.projectId(), command.shotId());
    if (contextJson == null)
      throw new ResourceNotFoundException("Current shot not found in project");
    Map<String, Object> context =
        JSON.readValue(contextJson, new TypeReference<Map<String, Object>>() {});
    var shot =
        shotAccess
            .findShotById(command.projectId(), command.shotId())
            .orElseThrow(() -> new ResourceNotFoundException("Shot not found"));
    GenerationStrategy strategy =
        command.strategy() == null ? shot.generationStrategy() : command.strategy();
    if (strategy != GenerationStrategy.TEXT_TO_VIDEO) {
      throw new DomainValidationException(
          "UNSUPPORTED_STRATEGY: Current Native AV profile supports only TEXT_TO_VIDEO");
    }
    String aspectRatio = (String) context.get("aspectRatioOverride");
    if (aspectRatio == null || aspectRatio.isBlank()) {
      aspectRatio = (String) context.get("imageAspectRatio");
    }
    var preflight =
        GenerationPreflightEvaluator.evaluate(
            strategy,
            catalog.supportedStrategies(),
            aspectRatio,
            catalog.supportedAspectRatios(),
            List.of(),
            Map.of());
    if (!preflight.ready()) throw new DomainValidationException(preflight.blockers().getFirst());
    String audioMode = command.audioMode() == null ? "LTX_NATIVE_AV" : command.audioMode();
    if (!"LTX_NATIVE_AV".equals(audioMode)) {
      throw new DomainValidationException(
          "UNSUPPORTED_AUDIO_MODE: Current LTX workflow supports only LTX_NATIVE_AV");
    }
    var references = takeRepository.findReferences(command.projectId(), command.shotId());
    if (references.stream().anyMatch(r -> "INVALID".equals(r.role()))) {
      throw new DomainValidationException("References must be READY assets in this Project");
    }
    if (!references.isEmpty()) {
      throw new DomainValidationException(
          "UNSUPPORTED_REFERENCE_CONDITIONING: Current LTX profile does not accept input artifacts");
    }
    pinVoices(context);
    // Resolved by ID through Scene.project_location_id; shots.location_ref is only a fallback.
    VideoLocationContext location =
        VideoLocationContext.from(
            preloaded != null
                ? preloaded
                : shotLocationContexts.findForShot(command.projectId(), command.shotId()));
    if (location != null) {
      context.put("locationContext", location.provenance());
    }
    List<NativeDialogueLine> dialogue = new ArrayList<>();
    NativeVoiceDescription primaryVoiceReference = null;
    @SuppressWarnings("unchecked")
    var voicesMap = (Map<String, Object>) context.getOrDefault("voices", Map.of());
    @SuppressWarnings("unchecked")
    var cues = (List<Map<String, Object>>) context.getOrDefault("cues", List.of());
    for (var cue : cues) {
      Object textObj = cue.get("adapted_text");
      if (textObj == null || textObj.toString().isBlank()) {
        textObj = cue.get("text");
      }
      if (textObj != null && !textObj.toString().isBlank()) {
        Object speakerObj = cue.get("speaker_project_character_id");
        String speaker = null;
        String voiceDesc = null;
        if (speakerObj != null && voicesMap.containsKey(speakerObj.toString())) {
          Object voiceVal = voicesMap.get(speakerObj.toString());
          if (voiceVal instanceof SpeakerVoiceAccess.ResolvedSpeakerVoice voice) {
            speaker = voice.characterName();
            voiceDesc = voice.voiceDescription();
            if (primaryVoiceReference == null) {
              primaryVoiceReference =
                  new NativeVoiceDescription(
                      voice.language(),
                      voice.accent(),
                      voice.voiceDescription(),
                      voice.deliveryBaseline());
            }
          }
        }
        dialogue.add(new NativeDialogueLine(speaker, textObj.toString().trim(), voiceDesc));
      }
    }

    NativeVideoInputs nativeInputs =
        nativeVideoInputMapper.map(shot, dialogue, primaryVoiceReference);
    validateNativeVideoInputs(shot.targetDurationMs(), nativeInputs);

    Map<String, Object> inputs = new TreeMap<>();
    inputs.put("workflowProfileId", catalog.defaultProfile());
    inputs.put("audioMode", "NATIVE_AV");
    inputs.put("dialogue", nativeInputs.dialogue());
    if (nativeInputs.voiceReference() != null) {
      inputs.put("voiceReference", nativeInputs.voiceReference());
    }
    inputs.put("width", 1280);
    inputs.put("height", 720);
    inputs.put("fps", 24);
    inputs.put("durationMs", shot.targetDurationMs());
    inputs.put("generationMode", strategy.name());
    if (nativeInputs.cameraIntent() != null) {
      inputs.put("cameraIntent", nativeInputs.cameraIntent());
    }
    if (nativeInputs.motionIntent() != null) {
      inputs.put("motionIntent", nativeInputs.motionIntent());
    }
    Map<String, Object> semantics = new TreeMap<>();
    semantics.put("context", context);
    semantics.put("inputs", inputs);
    semantics.put("modelRevision", catalog.modelRevision());
    semantics.put("workflowRevision", catalog.workflowRevision());
    semantics.put("qualityProfile", shot.qualityProfile());
    semantics.put("audioMode", audioMode);
    semantics.put("requestedSeed", command.seed());
    semantics.put("retryFromTakeId", command.retryFromTakeId());
    semantics.put("retryReason", command.retryReason());
    semantics.put("references", references);
    // Settings-independent view of the Shot-derived prompt: a changed Shot still changes the
    // request identity, while the prompt configuration (style, instructions) never does.
    semantics.put(
        "structuralPrompt", promptCompiler.compile(shot, (PromptSettings) null, null).prompt());
    String requestFingerprint =
        fingerprint(semantics, catalog.defaultProvider(), catalog.defaultModel());
    return new Prepared(
        shot,
        strategy,
        audioMode,
        context,
        inputs,
        semantics,
        references,
        requestFingerprint,
        location);
  }

  /** Compiled prompts plus the prompt-settings provenance frozen next to them. */
  private record PromptInput(
      String prompt, String negativePrompt, Map<String, Object> provenance) {}

  private PromptInput compilePrompt(
      StoryboardShotAccess.ShotView shot, PromptSettings settings, VideoLocationContext location) {
    var compiled = promptCompiler.compile(shot, settings, null, location);
    Map<String, Object> provenance = new TreeMap<>();
    provenance.put("revision", Long.toString(settings.revision()));
    provenance.put("styleId", settings.activeStyleId());
    provenance.put("effectiveHash", settings.effectiveHash());
    return new PromptInput(
        compiled.prompt(),
        compiled.negativePrompt() == null ? "" : compiled.negativePrompt(),
        provenance);
  }

  /**
   * Adds the prompts after the settings-independent request fingerprint was computed, so prompt
   * configuration never participates in idempotent replay but does shape the input fingerprint.
   */
  private static void bindPrompt(Prepared prepared, PromptInput input) {
    String negativePrompt = input.negativePrompt() == null ? "" : input.negativePrompt();
    validatePrompt(input.prompt(), negativePrompt);
    prepared.inputs().put("prompt", input.prompt());
    prepared.inputs().put("negativePrompt", negativePrompt);
    if (input.provenance() != null) {
      prepared.context().put("promptSettings", input.provenance());
    }
  }

  private static PromptInput frozenPrompt(String frozenInputJson) {
    var root = JSON.readTree(frozenInputJson);
    var inputs = root.path("inputs");
    if (!inputs.path("prompt").isTextual()) {
      throw new DomainValidationException("FROZEN_PROMPT_MISSING: Frozen shot input has no prompt");
    }
    String negativePrompt =
        inputs.path("negativePrompt").isTextual() ? inputs.path("negativePrompt").asText() : "";
    var provenanceNode = root.path("context").path("promptSettings");
    Map<String, Object> provenance =
        provenanceNode.isObject()
            ? JSON.readValue(provenanceNode.toString(), new TypeReference<Map<String, Object>>() {})
            : null;
    return new PromptInput(inputs.path("prompt").asText(), negativePrompt, provenance);
  }

  /**
   * Request fingerprint as computed before prompt settings existed: the compiled prompts were part
   * of the replay identity. Reconstructed from the prompts that were actually stored, so work
   * admitted by an older build still replays instead of conflicting.
   */
  private String legacyRequestFingerprint(Prepared prepared, PromptInput stored) {
    Map<String, Object> inputsCopy = new TreeMap<>(prepared.inputs());
    inputsCopy.put("prompt", stored.prompt());
    inputsCopy.put(
        "negativePrompt", stored.negativePrompt() == null ? "" : stored.negativePrompt());
    Map<String, Object> semanticsCopy = withoutLocationContext(prepared.semantics());
    semanticsCopy.put("inputs", inputsCopy);
    semanticsCopy.remove("structuralPrompt"); // not part of the pre-settings identity
    return fingerprint(semanticsCopy, catalog.defaultProvider(), catalog.defaultModel());
  }

  /**
   * Request fingerprint as computed before Location context joined the identity, so work admitted
   * by an older build still replays instead of conflicting.
   */
  private String locationFreeRequestFingerprint(Prepared prepared) {
    if (prepared.location() == null) return prepared.requestFingerprint();
    return fingerprint(
        withoutLocationContext(prepared.semantics()),
        catalog.defaultProvider(),
        catalog.defaultModel());
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> withoutLocationContext(Map<String, Object> semantics) {
    Map<String, Object> copy = new TreeMap<>(semantics);
    if (copy.get("context") instanceof Map<?, ?> context) {
      Map<String, Object> contextCopy = new TreeMap<>((Map<String, Object>) context);
      contextCopy.remove("locationContext");
      copy.put("context", contextCopy);
    }
    return copy;
  }

  /** Test seam: the pre-settings request fingerprint for prompts that were stored earlier. */
  String legacyFingerprintForStoredPrompts(
      GenerateShotTakeCommand command, String prompt, String negativePrompt) {
    return legacyRequestFingerprint(
        prepare(command, null), new PromptInput(prompt, negativePrompt, null));
  }

  private boolean isLegacyReplay(Prepared prepared, TakeInputSnapshot saved) {
    if (saved.context() != null && saved.context().containsKey("promptSettings")) return false;
    if (saved.inputs() == null || !(saved.inputs().get("prompt") instanceof String prompt)) {
      return false;
    }
    String negativePrompt =
        saved.inputs().get("negativePrompt") instanceof String value ? value : "";
    return legacyRequestFingerprint(prepared, new PromptInput(prompt, negativePrompt, null))
        .equals(saved.requestFingerprint());
  }

  private static void validatePrompt(String prompt, String negativePrompt) {
    if (prompt == null || prompt.isBlank() || prompt.length() > 20_000) {
      throw new DomainValidationException("INVALID_PROMPT: Expected 1 to 20000 characters");
    }
    if (negativePrompt.length() > 10_000) {
      throw new DomainValidationException("INVALID_NEGATIVE_PROMPT: Maximum is 10000 characters");
    }
  }

  private static void validateNativeVideoInputs(long durationMs, NativeVideoInputs inputs) {
    if (durationMs < 100 || durationMs > 10_000) {
      throw new DomainValidationException("INVALID_VIDEO_DURATION: Expected 100 to 10000 ms");
    }
    if (inputs.dialogue().size() > 32) {
      throw new DomainValidationException("INVALID_DIALOGUE_COUNT: Maximum is 32 lines");
    }
    for (var line : inputs.dialogue()) {
      if (line.text() == null || line.text().isBlank() || line.text().length() > 10_000) {
        throw new DomainValidationException(
            "INVALID_DIALOGUE_TEXT: Expected 1 to 10000 characters");
      }
      if (line.speaker() != null && line.speaker().length() > 200) {
        throw new DomainValidationException("INVALID_DIALOGUE_SPEAKER: Maximum is 200 characters");
      }
      if (line.voiceDescription() != null && line.voiceDescription().length() > 2_000) {
        throw new DomainValidationException(
            "INVALID_DIALOGUE_VOICE_DESCRIPTION: Maximum is 2000 characters");
      }
    }
    var voice = inputs.voiceReference();
    if (voice != null
        && ((voice.language() != null && voice.language().length() > 40)
            || (voice.accent() != null && voice.accent().length() > 200)
            || (voice.voiceDescription() != null && voice.voiceDescription().length() > 2_000)
            || (voice.deliveryBaseline() != null && voice.deliveryBaseline().length() > 1_000))) {
      throw new DomainValidationException(
          "INVALID_VOICE_REFERENCE: Field exceeds Native AV limits");
    }
  }

  @SuppressWarnings("unchecked")
  private void pinVoices(Map<String, Object> context) {
    var characters = (List<Map<String, Object>>) context.getOrDefault("characters", List.of());
    for (var character : characters) {
      if (character.get("characterVersionId") == null
          || !"LOCKED".equals(character.get("status"))) {
        throw new DomainValidationException(
            "Participating character requires a pinned locked CharacterVersion");
      }
    }
    Map<UUID, Optional<SpeakerVoiceAccess.ResolvedSpeakerVoice>> resolvedVoices = new HashMap<>();
    var cueInfos = new ArrayList<StoryboardProductionAccess.AudioCueInfo>();
    var voices = new TreeMap<String, Object>();
    for (var cue : (List<Map<String, Object>>) context.getOrDefault("cues", List.of())) {
      String type = cue.get("cue_type").toString();
      if (!Set.of("NARRATOR", "DIALOGUE", "INNER_MONOLOGUE", "SYSTEM").contains(type)) {
        throw new DomainValidationException("Unsupported audio cue type");
      }
      Object speaker = cue.get("speaker_project_character_id");
      UUID speakerId = speaker == null ? null : UUID.fromString(speaker.toString());
      cueInfos.add(new StoryboardProductionAccess.AudioCueInfo(null, null, 0, type, speakerId));
      if (speaker == null) continue;
      if (characters.stream().noneMatch(c -> speaker.equals(c.get("projectCharacterId")))) {
        throw new DomainValidationException("Speaker must participate in this Project");
      }
      var voice =
          resolvedVoices
              .computeIfAbsent(speakerId, speakerVoiceAccess::resolveSpeakerVoice)
              .filter(v -> v.voiceDescription() != null && !v.voiceDescription().isBlank())
              .orElseThrow(
                  () ->
                      new DomainValidationException(
                          "MISSING_VOICE_PROFILE: speaker needs a voice description"));
      voices.put(speaker.toString(), voice);
    }
    var preflight = GenerationPreflightEvaluator.evaluate(null, cueInfos, resolvedVoices);
    if (!preflight.ready()) throw new DomainValidationException(preflight.blockers().getFirst());
    context.put("voices", voices);
  }

  @SuppressWarnings("unchecked")
  private String fingerprint(Map<String, Object> semantics, String provider, String model) {
    // Normalize records to JSON objects before the existing canonical hasher sorts all map keys.
    Map<String, Object> normalized =
        JSON.readValue(
            JSON.writeValueAsString(semantics), new TypeReference<Map<String, Object>>() {});
    // System lifecycle updates do not change shot authoring inputs. Keep revision metadata in
    // the stored snapshot, but exclude it from transport replay identity.
    var semanticContext = (Map<String, Object>) normalized.get("context");
    semanticContext.remove("shotRowVersion");
    var semanticShot = (Map<String, Object>) semanticContext.get("shot");
    if (semanticShot != null) {
      for (String field : List.of("row_version", "status", "created_at", "updated_at")) {
        semanticShot.remove(field);
      }
    }
    return CanonicalFingerprintCalculator.calculateFingerprint(
        "1.0",
        new TaskDescriptorDto("video.generate", catalog.taskSchemaVersion()),
        new ModelRefDto(provider, model, catalog.modelRevision()),
        new TaskConstraintsDto(Instant.EPOCH, 1200),
        normalized,
        TaskArtifactsDto.empty());
  }

  private static TakeResponse response(TakeRepository.TakeRecord take, UUID jobId) {
    return new TakeResponse(
        take.id(),
        take.shotId(),
        take.attemptNumber(),
        take.provider(),
        take.model(),
        take.generationMode(),
        take.outputAssetId(),
        take.sourceDurationMs(),
        take.metricsJson(),
        take.validationStatus(),
        take.validationFailureCategory(),
        take.validationFailureReason(),
        take.validationRetryRecommendation(),
        take.status(),
        take.createdAt(),
        jobId);
  }
}
