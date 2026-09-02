package com.narrativex.backend.feature.localexecution.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.localexecution.application.port.out.LocalProjectRenderStore;
import com.narrativex.backend.feature.localexecution.infrastructure.persistence.mybatis.LocalProjectRenderArtifactRow;
import com.narrativex.backend.feature.localexecution.infrastructure.persistence.mybatis.LocalProjectRenderBeatMediaMapper;
import com.narrativex.backend.feature.localexecution.infrastructure.persistence.mybatis.LocalProjectRenderBeatMediaRow;
import com.narrativex.backend.feature.localexecution.infrastructure.persistence.mybatis.LocalProjectRenderMapper;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
@RequiredArgsConstructor
public class MyBatisLocalProjectRenderStore implements LocalProjectRenderStore {
  private final LocalProjectRenderMapper mapper;
  private final LocalProjectRenderBeatMediaMapper beatMediaMapper;

  @Override
  @Transactional
  public Optional<ClaimedProjectRender> claimNext(
      UUID deviceId, String workerId, UUID leaseToken, int leaseSeconds) {
    var row = mapper.claimNext(deviceId, workerId, leaseToken, leaseSeconds);
    if (row == null) return Optional.empty();

    var chapters =
        mapper.listChapters(row.generationJobId()).stream()
            .map(
                chapter ->
                    new ChapterInput(
                        chapter.chapterId(),
                        chapter.orderIndex(),
                        chapter.globalStartMs(),
                        chapter.globalEndMs(),
                        chapter.narrationAssetId(),
                        chapter.storageKey(),
                        chapter.sizeBytes(),
                        chapter.checksum(),
                        chapter.durationMs(),
                        chapter.subtitleText(),
                        chapter.subtitleSpansJson()))
            .toList();
    Map<UUID, LocalProjectRenderBeatMediaRow> mediaByBeat =
        beatMediaMapper.listBeatMedia(row.generationJobId()).stream()
            .collect(
                Collectors.toMap(
                    LocalProjectRenderBeatMediaRow::visualBeatId, Function.identity()));
    var beats =
        mapper.listBeats(row.generationJobId()).stream()
            .map(
                beat -> {
                  var media = mediaByBeat.get(beat.visualBeatId());
                  if (media == null) {
                    throw new IllegalStateException(
                        "Project render beat media snapshot is missing");
                  }
                  return new BeatInput(
                      beat.chapterId(),
                      beat.sceneIndex(),
                      beat.beatIndex(),
                      beat.visualBeatId(),
                      beat.mediaAssetId(),
                      beat.globalStartMs(),
                      beat.globalEndMs(),
                      beat.durationMs(),
                      beat.cameraMovement(),
                      media.mediaType(),
                      media.sourceDurationMs(),
                      media.fitMode(),
                      media.trimStartMs(),
                      beat.storageKey(),
                      beat.sizeBytes(),
                      beat.checksum());
                })
            .toList();
    return Optional.of(
        new ClaimedProjectRender(
            row.generationJobId(),
            row.jobId(),
            row.projectId(),
            row.storyVersionId(),
            row.resolution(),
            row.renderFormat(),
            row.aspectRatio(),
            row.totalDurationMs(),
            row.renderProfileJson(),
            leaseToken,
            chapters,
            beats));
  }

  @Override
  public boolean heartbeat(UUID jobId, UUID deviceId, String workerId, UUID leaseToken) {
    return mapper.heartbeat(jobId, deviceId, workerId, leaseToken) == 1;
  }

  @Override
  public boolean updateProgress(
      UUID jobId,
      UUID deviceId,
      String workerId,
      UUID leaseToken,
      int progress,
      String currentStep) {
    return mapper.updateProgress(jobId, deviceId, workerId, leaseToken, progress, currentStep) == 1;
  }

  @Override
  @Transactional
  public void complete(
      UUID jobId, UUID deviceId, String workerId, UUID leaseToken, CompletionResult result) {
    if (!mapper.ownsLease(jobId, deviceId, workerId, leaseToken)) {
      throw new IllegalStateException(
          "Desktop project render lease is no longer owned by this device");
    }

    LocalProjectRenderArtifactRow existing = mapper.findArtifact(jobId);
    if (existing == null) {
      int inserted =
          mapper.insertArtifact(
              jobId,
              deviceId,
              result.renderFingerprint(),
              result.storageKey(),
              result.mimeType(),
              result.sizeBytes(),
              result.checksumSha256(),
              result.durationMs(),
              result.width(),
              result.height(),
              result.fps());
      if (inserted != 1) {
        throw new IllegalStateException("Desktop project render artifact was not inserted");
      }
    } else if (!sameArtifact(existing, result)) {
      throw new IllegalStateException(
          "Existing project render artifact differs from the immutable desktop retry result");
    }

    if (mapper.completeStage(jobId, deviceId, workerId, leaseToken) != 1) {
      throw new IllegalStateException("Desktop project render lease was lost during completion");
    }
    if (mapper.completeJob(jobId, deviceId) != 1) {
      throw new IllegalStateException("Desktop project render job could not be completed");
    }
  }

  @Override
  @Transactional
  public boolean cancel(UUID jobId, UUID deviceId, String workerId, UUID leaseToken) {
    if (mapper.cancelStage(jobId, deviceId, workerId, leaseToken) != 1) return false;
    if (mapper.cancelJob(jobId, deviceId) != 1) {
      throw new IllegalStateException("Desktop project render cancellation was not persisted");
    }
    return true;
  }

  @Override
  @Transactional
  public boolean fail(
      UUID jobId,
      UUID deviceId,
      String workerId,
      UUID leaseToken,
      String errorCode,
      boolean retryable) {
    if (mapper.failStage(jobId, deviceId, workerId, leaseToken, retryable) != 1) return false;
    if (mapper.failJob(jobId, deviceId, errorCode, retryable) != 1) {
      throw new IllegalStateException("Desktop project render job failure state was not persisted");
    }
    return true;
  }

  private static boolean sameArtifact(
      LocalProjectRenderArtifactRow existing, CompletionResult result) {
    return Objects.equals(existing.renderFingerprint(), result.renderFingerprint())
        && Objects.equals(existing.storageKey(), result.storageKey())
        && Objects.equals(existing.mimeType(), result.mimeType())
        && existing.sizeBytes() == result.sizeBytes()
        && Objects.equals(existing.checksumSha256(), result.checksumSha256())
        && existing.durationMs() == result.durationMs()
        && existing.width() == result.width()
        && existing.height() == result.height()
        && existing.fps() == result.fps();
  }
}
