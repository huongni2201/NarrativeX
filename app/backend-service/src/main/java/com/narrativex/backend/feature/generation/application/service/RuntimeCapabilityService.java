package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.api.response.RuntimeCapabilityView;
import com.narrativex.backend.feature.generation.application.model.VideoRuntimeCapability;
import com.narrativex.backend.feature.generation.application.model.VideoRuntimeCapability.ResolutionProfile;
import com.narrativex.backend.feature.generation.application.port.out.VideoGenerationCatalog;
import com.narrativex.backend.feature.generation.application.query.RuntimeCapabilityQuery;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class RuntimeCapabilityService {
  private final VideoGenerationCatalog catalog;

  public RuntimeCapabilityView query(RuntimeCapabilityQuery query) {
    var strategies =
        catalog.supportedStrategies().stream()
            .map(Enum::name)
            .toList();

    var videoCap =
        new VideoRuntimeCapability(
            true,
            catalog.defaultProvider(),
            catalog.defaultModel(),
            catalog.defaultProfile(),
            strategies,
            catalog.supportedAspectRatios(),
            List.of(new ResolutionProfile(1280, 720, 24)),
            List.of("LTX_NATIVE_AV"));

    return new RuntimeCapabilityView(videoCap);
  }
}
