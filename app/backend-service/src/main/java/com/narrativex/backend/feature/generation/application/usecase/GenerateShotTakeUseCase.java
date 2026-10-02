package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.character.application.port.in.SpeakerVoiceAccess;
import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.api.response.TakeResponse;
import com.narrativex.backend.feature.generation.application.command.GenerateShotTakeCommand;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.TakeRepository;
import com.narrativex.backend.feature.generation.application.port.out.TakeRepository.TakeRecord;
import com.narrativex.backend.feature.generation.application.port.out.VideoJobDispatcher;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess.AudioCueInfo;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess.ChapterInfo;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess.ShotInfo;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess.ShotSequenceInfo;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardProductionAccess.VisualBeatInfo;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@Slf4j
@Service
@RequiredArgsConstructor
public class GenerateShotTakeUseCase {
  private static final JsonMapper JSON = JsonMapper.builder().build();

  private final StoryboardProductionAccess storyboardAccess;
  private final SpeakerVoiceAccess speakerVoiceAccess;
  private final TakeRepository takeRepository;
  private final GenerationJobRepository generationJobRepository;
  private final VideoJobDispatcher videoJobDispatcher;

  @Transactional
  public TakeResponse execute(GenerateShotTakeCommand command) {
    UUID projectId = command.projectId();
    UUID shotId = command.shotId();

    UUID chapterId = storyboardAccess.findChapterIdByShotId(projectId, shotId);
    if (chapterId == null) {
      throw new ResourceNotFoundException("Shot " + shotId + " not found in project " + projectId);
    }
    ShotInfo shot =
        storyboardAccess
            .findShot(projectId, shotId)
            .orElseThrow(() -> new ResourceNotFoundException("Shot " + shotId + " not found"));

    Optional<ChapterInfo> chapter = storyboardAccess.findChapter(chapterId);
    UUID storyVersionId = chapter.map(ChapterInfo::storyVersionId).orElse(null);

    GenerationStrategy strategy =
        command.strategy() != null
            ? command.strategy()
            : (shot.generationStrategy() != null
                ? shot.generationStrategy()
                : GenerationStrategy.TEXT_TO_VIDEO);

    if (strategy == GenerationStrategy.MULTI_KEYFRAME
        || strategy == GenerationStrategy.VIDEO_EXTEND
        || strategy == GenerationStrategy.VIDEO_RETAKE) {
      throw new DomainValidationException(
          "UNSUPPORTED_STRATEGY: Strategy "
              + strategy
              + " is not supported by current video runtime.");
    }
    if (shot.generationStrategy() != strategy) {
      storyboardAccess.updateShotStrategy(shotId, strategy);
    }

    validateDialogueVoiceReadiness(shot);

    Map<String, Object> meta = new HashMap<>();
    meta.put("shotId", shotId.toString());
    meta.put("strategy", strategy.name());
    if (command.seed() != null && command.seed() > 0) {
      meta.put("seed", command.seed());
    }
    if (command.retryFromTakeId() != null) {
      meta.put("retryFromTakeId", command.retryFromTakeId().toString());
    }
    if (command.retryReason() != null) {
      meta.put("retryReason", command.retryReason());
    }

    String sourceText;
    try {
      sourceText = JSON.writeValueAsString(meta);
    } catch (Exception e) {
      sourceText = "{\"shotId\":\"" + shotId + "\"}";
    }

    String idempotencyKey = "shot-take-gen:" + shotId + ":" + System.currentTimeMillis();

    GenerationJob job =
        GenerationJob.createShotVideoGeneration(
            projectId, storyVersionId, chapterId, sourceText, idempotencyKey);
    GenerationJob savedJob = generationJobRepository.save(job);

    videoJobDispatcher.dispatch(savedJob.getJobId());

    List<TakeRecord> takes = takeRepository.findByShotId(shotId);
    TakeRecord latestTake =
        takes.stream().max(Comparator.comparingInt(TakeRecord::attemptNumber)).orElse(null);

    if (latestTake == null) {
      return null;
    }
    return new TakeResponse(
        latestTake.id(),
        latestTake.shotId(),
        latestTake.attemptNumber(),
        latestTake.provider(),
        latestTake.model(),
        latestTake.generationMode(),
        latestTake.outputAssetId(),
        latestTake.sourceDurationMs(),
        latestTake.metricsJson(),
        latestTake.validationStatus(),
        latestTake.validationFailureCategory(),
        latestTake.validationFailureReason(),
        latestTake.validationRetryRecommendation(),
        latestTake.status(),
        latestTake.createdAt(),
        savedJob.getJobId());
  }

  private void validateDialogueVoiceReadiness(ShotInfo shot) {
    if (shot.sequenceId() == null) return;
    Optional<ShotSequenceInfo> seqOpt = storyboardAccess.findSequenceById(shot.sequenceId());
    if (seqOpt.isEmpty() || seqOpt.get().visualBeatId() == null) return;

    Optional<VisualBeatInfo> vbOpt = storyboardAccess.findVisualBeat(seqOpt.get().visualBeatId());
    if (vbOpt.isEmpty() || vbOpt.get().storyBeatId() == null) return;

    List<AudioCueInfo> cues = storyboardAccess.findAudioCues(List.of(vbOpt.get().storyBeatId()));
    for (AudioCueInfo cue : cues) {
      if ("DIALOGUE".equalsIgnoreCase(cue.cueType())
          || "VOICEOVER".equalsIgnoreCase(cue.cueType())) {
        if (cue.speakerProjectCharacterId() != null) {
          var resolved = speakerVoiceAccess.resolveSpeakerVoice(cue.speakerProjectCharacterId());
          if (resolved.isEmpty() || resolved.get().referenceAssetId() == null) {
            throw new DomainValidationException(
                "MISSING_VOICE_REFERENCE: Speaker requires an active character voice profile with reference audio.");
          }
        }
      }
    }
  }
}
