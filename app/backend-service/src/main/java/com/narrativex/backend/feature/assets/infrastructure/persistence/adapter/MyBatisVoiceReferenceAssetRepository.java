package com.narrativex.backend.feature.assets.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.assets.application.port.out.VoiceReferenceAssetRepository;
import com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis.VoiceReferenceAssetMapper;
import com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis.VoiceReferenceAssetRow;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
@RequiredArgsConstructor
public class MyBatisVoiceReferenceAssetRepository implements VoiceReferenceAssetRepository {
  private final VoiceReferenceAssetMapper mapper;

  @Override
  @Transactional
  public VoiceReferenceAsset createOrReuse(String accountId, CreateVoiceReference command) {
    String checksum = command.sha256().toLowerCase(Locale.ROOT);
    VoiceReferenceAssetRow existing = mapper.findByChecksum(accountId, checksum);
    if (existing != null) return existing.toDomain();

    mapper.insert(accountId, command, checksum);
    VoiceReferenceAssetRow claimed = mapper.findByChecksum(accountId, checksum);
    if (claimed == null) {
      throw new IllegalStateException("Voice reference checksum claim disappeared");
    }
    return claimed.toDomain();
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<VoiceReferenceAsset> findOwned(String accountId, UUID id) {
    return Optional.ofNullable(mapper.findOwned(accountId, id)).map(VoiceReferenceAssetRow::toDomain);
  }

  @Override
  @Transactional(readOnly = true)
  public List<VoiceReferenceAsset> listOwned(String accountId) {
    return mapper.listOwned(accountId).stream().map(VoiceReferenceAssetRow::toDomain).toList();
  }

  @Override
  @Transactional(readOnly = true)
  public boolean isReferencedByReadyAsset(String storageKey) {
    return mapper.isReferencedByReadyAsset(storageKey);
  }
}
