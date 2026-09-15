package com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.assets.application.port.out.VoiceReferenceAssetRepository.CreateVoiceReference;
import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface VoiceReferenceAssetMapper extends NarrativeXMyBatisMapper {
  int insert(
      @Param("command") CreateVoiceReference command,
      @Param("checksum") String checksum);

  VoiceReferenceAssetRow findById(@Param("id") UUID id);

  VoiceReferenceAssetRow findByChecksum(@Param("sha256") String sha256);

  List<VoiceReferenceAssetRow> list();

  boolean isReferencedByReadyAsset(@Param("storageKey") String storageKey);
}
