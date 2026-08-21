package com.narrativex.backend.feature.catalog.application.port.out;

import com.narrativex.backend.feature.catalog.application.query.StylePresetView;
import com.narrativex.backend.feature.catalog.application.query.VoiceView;
import java.util.List;

public interface CatalogQueryRepository {
  List<StylePresetView> listStylePresets(String category);

  List<VoiceView> listVoices(String language);
}
