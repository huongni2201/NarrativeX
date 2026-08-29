package com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.assets.application.port.out.VoiceReferenceAssetRepository.CreateVoiceReference;
import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface VoiceReferenceAssetMapper extends NarrativeXMyBatisMapper {
  int insert(
      @Param("accountId") String accountId,
      @Param("command") CreateVoiceReference command,
      @Param("checksum") String checksum);

  VoiceReferenceAssetRow findOwned(@Param("accountId") String accountId, @Param("id") UUID id);

  VoiceReferenceAssetRow findByChecksum(
      @Param("accountId") String accountId, @Param("sha256") String sha256);

  List<VoiceReferenceAssetRow> listOwned(@Param("accountId") String accountId);

  boolean isReferencedByReadyAsset(@Param("storageKey") String storageKey);
}
