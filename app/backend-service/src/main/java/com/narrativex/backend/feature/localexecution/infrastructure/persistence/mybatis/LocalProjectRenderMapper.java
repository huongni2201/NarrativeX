package com.narrativex.backend.feature.localexecution.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface LocalProjectRenderMapper extends NarrativeXMyBatisMapper {
  LocalProjectRenderJobRow claimNext(
      @Param("deviceId") UUID deviceId,
      @Param("workerId") String workerId,
      @Param("leaseToken") UUID leaseToken,
      @Param("leaseSeconds") int leaseSeconds);

  List<LocalProjectRenderChapterRow> listChapters(
      @Param("generationJobId") UUID generationJobId);

  List<LocalProjectRenderBeatRow> listBeats(
      @Param("generationJobId") UUID generationJobId);

  int heartbeat(
      @Param("jobId") UUID jobId,
      @Param("deviceId") UUID deviceId,
      @Param("workerId") String workerId,
      @Param("leaseToken") UUID leaseToken);

  int updateProgress(
      @Param("jobId") UUID jobId,
      @Param("deviceId") UUID deviceId,
      @Param("workerId") String workerId,
      @Param("leaseToken") UUID leaseToken,
      @Param("progress") int progress,
      @Param("currentStep") String currentStep);

  boolean ownsLease(
      @Param("jobId") UUID jobId,
      @Param("deviceId") UUID deviceId,
      @Param("workerId") String workerId,
      @Param("leaseToken") UUID leaseToken);

  LocalProjectRenderArtifactRow findArtifact(@Param("jobId") UUID jobId);

  int insertArtifact(
      @Param("jobId") UUID jobId,
      @Param("deviceId") UUID deviceId,
      @Param("renderFingerprint") String renderFingerprint,
      @Param("storageKey") String storageKey,
      @Param("storageProvider") String storageProvider,
      @Param("externalFileId") String externalFileId,
      @Param("webViewLink") String webViewLink,
      @Param("mimeType") String mimeType,
      @Param("sizeBytes") long sizeBytes,
      @Param("checksumSha256") String checksumSha256,
      @Param("durationMs") long durationMs,
      @Param("width") int width,
      @Param("height") int height,
      @Param("fps") int fps);

  int completeStage(
      @Param("jobId") UUID jobId,
      @Param("deviceId") UUID deviceId,
      @Param("workerId") String workerId,
      @Param("leaseToken") UUID leaseToken);

  int completeJob(@Param("jobId") UUID jobId, @Param("deviceId") UUID deviceId);

  int failStage(
      @Param("jobId") UUID jobId,
      @Param("deviceId") UUID deviceId,
      @Param("workerId") String workerId,
      @Param("leaseToken") UUID leaseToken,
      @Param("retryable") boolean retryable);

  int failJob(
      @Param("jobId") UUID jobId,
      @Param("deviceId") UUID deviceId,
      @Param("errorCode") String errorCode,
      @Param("retryable") boolean retryable);
}
