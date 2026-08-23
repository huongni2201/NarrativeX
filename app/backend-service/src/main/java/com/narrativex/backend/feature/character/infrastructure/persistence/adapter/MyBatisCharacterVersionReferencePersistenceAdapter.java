package com.narrativex.backend.feature.character.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.character.application.port.out.CharacterVersionReferenceRepository;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.CharacterVersionReferenceMapper;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.CharacterVersionReferenceRow;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisCharacterVersionReferencePersistenceAdapter
    implements CharacterVersionReferenceRepository {
  private final CharacterVersionReferenceMapper mapper;

  @Override
  public List<Reference> findByVersionId(Long characterVersionId) {
    return mapper.findByVersionId(characterVersionId).stream()
        .map(row -> new Reference(row.getMediaAssetId(), row.getReferenceRole(), row.getPriority()))
        .toList();
  }

  @Override
  public void replace(Long characterVersionId, List<Reference> references) {
    mapper.deleteByVersionId(characterVersionId);
    for (Reference reference : references) {
      CharacterVersionReferenceRow row = new CharacterVersionReferenceRow();
      row.setCharacterVersionId(characterVersionId);
      row.setMediaAssetId(reference.mediaAssetId());
      row.setReferenceRole(reference.role());
      row.setPriority(reference.priority());
      if (mapper.insert(row) != 1) {
        throw new IllegalStateException("Could not persist character version reference");
      }
    }
  }
}
