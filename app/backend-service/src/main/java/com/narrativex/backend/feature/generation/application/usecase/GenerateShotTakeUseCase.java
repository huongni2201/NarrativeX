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
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationOutboxRepository;
import com.narrativex.backend.feature.generation.application.port.out.OperationPlanRepository;
import com.narrativex.backend.feature.generation.application.port.out.StageAttemptRepository;
import com.narrativex.backend.feature.generation.application.port.out.TakeRepository;
import com.narrativex.backend.feature.generation.application.port.out.VideoGenerationCatalog;
import com.narrativex.backend.feature.generation.application.port.out.VoiceReferenceAssetAccess;
import com.narrativex.backend.feature.generation.application.service.ComputeAttemptIdentity;
import com.narrativex.backend.feature.generation.application.service.GenerationPreflightEvaluator;
import com.narrativex.backend.feature.generation.application.service.VideoPromptCompiler;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.aggregate.OperationPlan;
import com.narrativex.backend.feature.generation.domain.entity.StageAttempt;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
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
  private final VoiceReferenceAssetAccess voiceReferenceAssetAccess;
  private final TakeRepository takeRepository;
  private final GenerationJobRepository generationJobRepository;
  private final OperationPlanRepository operationPlanRepository;
  private final StageAttemptRepository stageAttemptRepository;
  private final GenerationOutboxRepository outboxRepository;
  private final VideoGenerationCatalog catalog;
  private final VideoPromptCompiler promptCompiler;
  private final NarrativeXLimitsProperties limits;

  @Transactional
  public TakeResponse execute(GenerateShotTakeCommand command) {
    return admit(command, null);
  }

  @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NESTED)
  public TakeResponse executeFrozen(GenerateShotTakeCommand command, String frozenFingerprint) {
    return admit(command, Objects.requireNonNull(frozenFingerprint));
  }

  @Transactional
  public FrozenShot freeze(GenerateShotTakeCommand command) {
    var prepared = prepare(command);
    return new FrozenShot(
        prepared.requestFingerprint(), JSON.writeValueAsString(prepared.semantics()));
  }

  public record FrozenShot(String requestFingerprint, String inputJson) {}

  private record Prepared(
      StoryboardShotAccess.ShotView shot,
      GenerationStrategy strategy,
      String audioMode,
      Map<String, Object> context,
      Map<String, Object> inputs,
      Map<String, Object> semantics,
      List<TakeInputSnapshot.Reference> references,
      String requestFingerprint) {}

  private TakeResponse admit(GenerateShotTakeCommand command, String frozenFingerprint) {
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
    var prepared = prepare(command);
    var shot = prepared.shot();
    var strategy = prepared.strategy();
    var audioMode = prepared.audioMode();
    var context = prepared.context();
    var inputs = prepared.inputs();
    var semantics = prepared.semantics();
    var references = prepared.references();
    String requestFingerprint = prepared.requestFingerprint();
    if (frozenFingerprint != null && !frozenFingerprint.equals(requestFingerprint)) {
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
      if (!requestFingerprint.equals(saved.requestFingerprint())) {
        throw new ResourceConflictException("Idempotency-Key reused with different shot inputs");
      }
      return response(take, existing.get().getJobId());
    }
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

  private Prepared prepare(GenerateShotTakeCommand command) {
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
    String aspectRatio = (String) context.get("aspectRatioOverride");
    if (aspectRatio == null || aspectRatio.isBlank()) {
      aspectRatio = (String) context.get("imageAspectRatio");
    }
    var preflight =
        GenerationPreflightEvaluator.evaluate(
            strategy, catalog.supportedStrategies(), aspectRatio, List.of(), Map.of());
    if (!preflight.ready()) throw new DomainValidationException(preflight.blockers().getFirst());
    String audioMode = command.audioMode() == null ? "LTX_NATIVE_AV" : command.audioMode();
    if (!Set.of("LTX_NATIVE_AV", "AUDIO_FIRST").contains(audioMode)) {
      throw new IllegalArgumentException("Unsupported audioMode");
    }
    var references = takeRepository.findReferences(command.projectId(), command.shotId());
    if (references.stream().anyMatch(r -> "INVALID".equals(r.role()))) {
      throw new DomainValidationException("References must be READY assets in this Project");
    }
    if (!references.isEmpty() && !"APPROVED".equals(context.get("visualBeatReviewStatus"))) {
      throw new DomainValidationException("Conditioning references require an approved VisualBeat");
    }
    boolean start = references.stream().anyMatch(r -> "start-frame".equals(r.role()));
    boolean end = references.stream().anyMatch(r -> "end-frame".equals(r.role()));
    if ((strategy == GenerationStrategy.IMAGE_TO_VIDEO && !start)
        || (strategy == GenerationStrategy.FIRST_LAST_FRAME && !(start && end))) {
      throw new DomainValidationException(
          "MISSING_REFERENCE: strategy requires approved start/end frames");
    }
    pinVoices(context);
    var compiled = promptCompiler.compile(shot, ImageStyle.CINEMATIC, null);
    StringBuilder prompt = new StringBuilder(compiled.prompt());
    appendNarration(context, prompt);
    Map<String, Object> inputs = new TreeMap<>();
    inputs.put("prompt", prompt.toString());
    inputs.put("negativePrompt", compiled.negativePrompt());
    inputs.put("width", 1280);
    inputs.put("height", 720);
    inputs.put("fps", 24);
    inputs.put("durationMs", shot.targetDurationMs());
    inputs.put("generationMode", strategy.name());
    inputs.put("cameraIntent", JSON.readValue(shot.cameraMotionJson(), Map.class));
    inputs.put("motionIntent", JSON.readValue(shot.subjectMotionJson(), Map.class));
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
    String requestFingerprint =
        fingerprint(semantics, catalog.defaultProvider(), catalog.defaultModel());
    return new Prepared(
        shot, strategy, audioMode, context, inputs, semantics, references, requestFingerprint);
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
    var voiceReferences = new TreeMap<String, Object>();
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
      if (voice.referenceAssetId() != null && !voiceReferences.containsKey(speaker.toString())) {
        var reference =
            voiceReferenceAssetAccess.find(
                UUID.fromString(context.get("projectId").toString()),
                new com.narrativex.backend.feature.generation.application.model
                    .VoiceReferenceSelection(voice.referenceScope(), voice.referenceAssetId()));
        if (!"READY".equals(reference.status())
            || reference.sha256() == null
            || !reference.sha256().matches("[0-9a-fA-F]{64}")
            || reference.sizeBytes() <= 0) {
          throw new DomainValidationException(
              "Voice reference must be READY with integrity metadata");
        }
        voiceReferences.put(speaker.toString(), reference);
      }
    }
    var preflight = GenerationPreflightEvaluator.evaluate(null, cueInfos, resolvedVoices);
    if (!preflight.ready()) throw new DomainValidationException(preflight.blockers().getFirst());
    context.put("voices", voices);
    context.put("voiceReferences", voiceReferences);
  }

  @SuppressWarnings("unchecked")
  private void appendNarration(Map<String, Object> context, StringBuilder prompt) {
    for (var cue : (List<Map<String, Object>>) context.getOrDefault("cues", List.of())) {
      Object text = cue.get("adapted_text");
      if (text != null && !text.toString().isBlank()) {
        prompt.append("\n").append(cue.get("cue_type")).append(": ").append(text);
        if (cue.get("delivery_hint") != null)
          prompt.append(". Delivery: ").append(cue.get("delivery_hint"));
      }
    }
    for (var voice : ((Map<String, Object>) context.get("voices")).values()) {
      var v = (SpeakerVoiceAccess.ResolvedSpeakerVoice) voice;
      prompt
          .append("\nSpeaker ")
          .append(v.characterName())
          .append(": ")
          .append(v.voiceDescription());
      if (v.accent() != null) prompt.append(". Accent: ").append(v.accent());
      if (v.deliveryBaseline() != null) prompt.append(". Delivery: ").append(v.deliveryBaseline());
    }
  }

  @SuppressWarnings("unchecked")
  private static String fingerprint(Map<String, Object> semantics, String provider, String model) {
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
        new TaskDescriptorDto("video.generate", "1.0"),
        new ModelRefDto(provider, model, "1.0"),
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
