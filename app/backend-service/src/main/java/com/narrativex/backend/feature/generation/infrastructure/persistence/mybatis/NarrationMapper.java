package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface NarrationMapper extends NarrativeXMyBatisMapper {
  int insertRequest(NarrationRequestRow row);

  NarrationRequestRow findRequestByFingerprint(
      @Param("requestFingerprint") String requestFingerprint);

  NarrationRequestRow findRequestByGenerationJobId(@Param("generationJobId") UUID generationJobId);

  int insertOperation(NarrationOperationRow row);

  VoicePreviewResultRow findCompletedVoicePreview(
      @Param("projectId") UUID projectId, @Param("jobId") UUID jobId);

  int insertProjectAsset(
      @Param("id") UUID id,
      @Param("projectId") UUID projectId,
      @Param("name") String name,
      @Param("storageKey") String storageKey,
      @Param("mimeType") String mimeType);

  int archiveProjectAsset(@Param("id") UUID id);

  NarrationAssetRow findAssetByRequest(@Param("narrationRequestId") UUID narrationRequestId);

  NarrationAssetRow findAssetByProjectAsset(@Param("projectAssetId") UUID projectAssetId);

  int insertNarrationAsset(
      @Param("id") UUID id,
      @Param("narrationRequestId") UUID narrationRequestId,
      @Param("projectAssetId") UUID projectAssetId,
      @Param("durationMs") long durationMs,
      @Param("sizeBytes") long sizeBytes,
      @Param("codec") String codec,
      @Param("sampleRateHz") int sampleRateHz,
      @Param("channels") int channels,
      @Param("checksum") String checksum);

  int replaceNarrationAsset(
      @Param("id") UUID id,
      @Param("projectAssetId") UUID projectAssetId,
      @Param("durationMs") long durationMs,
      @Param("sizeBytes") long sizeBytes,
      @Param("codec") String codec,
      @Param("sampleRateHz") int sampleRateHz,
      @Param("channels") int channels,
      @Param("checksum") String checksum);

  int deleteAlignments(@Param("narrationAssetId") UUID narrationAssetId);

  int insertAlignment(
      @Param("narrationAssetId") UUID narrationAssetId,
      @Param("sourceHash") String sourceHash,
      @Param("alignmentVersion") String alignmentVersion,
      @Param("wordsJson") String wordsJson);
}
