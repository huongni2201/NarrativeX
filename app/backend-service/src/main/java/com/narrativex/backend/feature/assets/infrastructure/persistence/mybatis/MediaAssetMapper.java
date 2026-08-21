package com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface MediaAssetMapper extends NarrativeXMyBatisMapper {
  UUID insert(MediaAssetRow row);

  List<MediaAssetRow> findPage(
      @Param("accountId") String accountId,
      @Param("type") String type,
      @Param("status") String status,
      @Param("search") String search,
      @Param("cursorCreatedAt") Instant cursorCreatedAt,
      @Param("cursorId") UUID cursorId,
      @Param("limit") int limit);

  MediaAssetRow findOwned(@Param("accountId") String accountId, @Param("id") UUID id);

  MediaAssetRow findVerifiedByChecksum(
      @Param("accountId") String accountId, @Param("sha256") String sha256);

  int markUploading(@Param("accountId") String accountId, @Param("id") UUID id);

  int markValidating(@Param("accountId") String accountId, @Param("id") UUID id);

  int approve(@Param("accountId") String accountId, @Param("id") UUID id);

  int reject(@Param("accountId") String accountId, @Param("id") UUID id);

  int softDelete(@Param("accountId") String accountId, @Param("id") UUID id);
}
