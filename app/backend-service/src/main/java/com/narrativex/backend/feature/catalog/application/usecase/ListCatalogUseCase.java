package com.narrativex.backend.feature.catalog.application.usecase;

import com.narrativex.backend.feature.catalog.application.port.out.CatalogQueryRepository;
import com.narrativex.backend.feature.catalog.application.query.StylePresetView;
import com.narrativex.backend.feature.catalog.application.query.VoiceView;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ListCatalogUseCase {
  private final CatalogQueryRepository repository;

  @Transactional(readOnly = true)
  public List<StylePresetView> stylePresets(String category) {
    return repository.listStylePresets(category);
  }

  @Transactional(readOnly = true)
  public List<VoiceView> voices(String language) {
    return repository.listVoices(language);
  }
}
