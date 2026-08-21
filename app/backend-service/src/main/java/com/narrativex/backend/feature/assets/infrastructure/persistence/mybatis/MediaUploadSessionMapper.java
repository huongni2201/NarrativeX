package com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository.CreateUploadSession;
import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface MediaUploadSessionMapper extends NarrativeXMyBatisMapper {
  int insert(CreateUploadSession command);

  MediaUploadSessionRow findOwned(@Param("accountId") String accountId, @Param("id") UUID id);

  MediaUploadSessionRow findByIdempotencyKey(
      @Param("accountId") String accountId, @Param("idempotencyKey") String idempotencyKey);

  int markReady(
      @Param("accountId") String accountId,
      @Param("id") UUID id,
      @Param("mediaAssetId") UUID mediaAssetId);

  int markRejected(@Param("accountId") String accountId, @Param("id") UUID id);
}
