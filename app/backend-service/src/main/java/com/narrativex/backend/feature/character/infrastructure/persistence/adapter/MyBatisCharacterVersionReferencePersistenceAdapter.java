package com.narrativex.backend.feature.character.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.character.application.port.out.CharacterVersionReferenceRepository;
import com.narrativex.backend.feature.character.domain.enums.CharacterReferenceSlot;
import com.narrativex.backend.feature.character.domain.value.CharacterVersionReference;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.CharacterVersionReferenceMapper;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.CharacterVersionReferenceRow;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisCharacterVersionReferencePersistenceAdapter
    implements CharacterVersionReferenceRepository {
  private final CharacterVersionReferenceMapper mapper;

  @Override
  public List<CharacterVersionReference> findByVersionId(UUID characterVersionId) {
    return mapper.findByVersionId(characterVersionId).stream()
        .map(
            row ->
                new CharacterVersionReference(
                    row.getMediaAssetId(),
                    row.getReferenceRole(),
                    row.getPriority(),
                    row.getReferenceSlot() == null
                        ? null
                        : CharacterReferenceSlot.valueOf(row.getReferenceSlot())))
        .toList();
  }

  @Override
  public void replace(UUID characterVersionId, List<CharacterVersionReference> references) {
    mapper.deleteByVersionId(characterVersionId);
    for (CharacterVersionReference reference : references) {
      CharacterVersionReferenceRow row = new CharacterVersionReferenceRow();
      row.setCharacterVersionId(characterVersionId);
      row.setMediaAssetId(reference.mediaAssetId());
      row.setReferenceRole(reference.role());
      row.setPriority(reference.priority());
      row.setReferenceSlot(reference.slot() == null ? null : reference.slot().name());
      if (mapper.insert(row) != 1) {
        throw new IllegalStateException("Could not persist character version reference");
      }
    }
  }
}
