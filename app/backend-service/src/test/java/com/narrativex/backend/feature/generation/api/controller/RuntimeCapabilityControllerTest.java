package com.narrativex.backend.feature.generation.api.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

import com.narrativex.backend.feature.generation.api.response.RuntimeCapabilityView;
import com.narrativex.backend.feature.generation.application.model.VideoRuntimeCapability;
import com.narrativex.backend.feature.generation.application.model.VideoRuntimeCapability.ResolutionProfile;
import com.narrativex.backend.feature.generation.application.service.RuntimeCapabilityService;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;

class RuntimeCapabilityControllerTest {
  private final RuntimeCapabilityService runtimeCapabilityService =
      mock(RuntimeCapabilityService.class);
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc =
        standaloneSetup(new RuntimeCapabilityController(runtimeCapabilityService))
            .setControllerAdvice(
                new com.narrativex.backend.feature.common.api.ApiExceptionHandler())
            .build();
  }

  @Test
  void getCapabilitiesReturnsAuthoritativeVideoRuntimeProfile() throws Exception {
    var videoCap =
        new VideoRuntimeCapability(
            true,
            "ltx",
            "ltx-2.5-22b-distilled-int8",
            "ltx-2.5-22b-distilled-int8-native-av-v1",
            List.of("TEXT_TO_VIDEO"),
            List.of("16:9"),
            List.of(new ResolutionProfile(1280, 720, 24)),
            List.of("LTX_NATIVE_AV"));
    when(runtimeCapabilityService.query(any())).thenReturn(new RuntimeCapabilityView(videoCap));

    mockMvc
        .perform(get("/api/v1/runtime/capabilities"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.videoGeneration.available").value(true))
        .andExpect(jsonPath("$.data.videoGeneration.provider").value("ltx"))
        .andExpect(jsonPath("$.data.videoGeneration.model").value("ltx-2.5-22b-distilled-int8"))
        .andExpect(
            jsonPath("$.data.videoGeneration.profile")
                .value("ltx-2.5-22b-distilled-int8-native-av-v1"))
        .andExpect(jsonPath("$.data.videoGeneration.strategies[0]").value("TEXT_TO_VIDEO"))
        .andExpect(jsonPath("$.data.videoGeneration.supportedAspectRatios[0]").value("16:9"))
        .andExpect(jsonPath("$.data.videoGeneration.resolutionProfiles[0].width").value(1280))
        .andExpect(jsonPath("$.data.videoGeneration.resolutionProfiles[0].height").value(720))
        .andExpect(jsonPath("$.data.videoGeneration.resolutionProfiles[0].fps").value(24))
        .andExpect(jsonPath("$.data.videoGeneration.audioModes[0]").value("LTX_NATIVE_AV"));
  }
}
