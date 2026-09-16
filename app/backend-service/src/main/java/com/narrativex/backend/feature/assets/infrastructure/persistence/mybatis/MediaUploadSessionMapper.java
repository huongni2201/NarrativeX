package com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository.CreateUploadSession;
import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface MediaUploadSessionMapper extends NarrativeXMyBatisMapper {
  int insert(CreateUploadSession command);

  MediaUploadSessionRow findSnapshot(@Param("id") UUID id);

  MediaUploadSessionRow findForUpdate(@Param("id") UUID id);

  MediaUploadSessionRow findByIdempotencyKey(@Param("idempotencyKey") String idempotencyKey);

  int markValidating(@Param("id") UUID id, @Param("mediaAssetId") UUID mediaAssetId);

  int markReady(@Param("id") UUID id, @Param("mediaAssetId") UUID mediaAssetId);

  int markRejected(@Param("id") UUID id);

  List<ExpiredUploadRow> findExpiredPending(@Param("limit") int limit);

  List<RejectedUploadRow> findRejectedForCleanup(@Param("limit") int limit);
}
