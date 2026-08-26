package com.narrativex.backend.feature.catalog.api.controller;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

import com.narrativex.backend.feature.catalog.application.query.StylePresetView;
import com.narrativex.backend.feature.catalog.application.usecase.ListCatalogUseCase;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;

class CatalogControllerTest {
  private final ListCatalogUseCase listCatalogUseCase = mock(ListCatalogUseCase.class);
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc = standaloneSetup(new CatalogController(listCatalogUseCase)).build();
  }

  @Test
  void stylePresetResponseSerializesOnlyPublicCatalogFields() throws Exception {
    when(listCatalogUseCase.stylePresets("VISUAL_STYLE"))
        .thenReturn(
            List.of(
                new StylePresetView(
                    1L,
                    "Cinematic Warmth",
                    "VISUAL_STYLE",
                    "Warm cinematic lighting with grounded texture.",
                    "https://example.test/cinematic-warmth.jpg",
                    "internal prompt suffix",
                    "internal negative prompt",
                    List.of("cinematic", "warm"),
                    "{\"defaultQuality\":\"Standard\"}",
                    Instant.parse("2026-08-20T00:00:00Z"))));

    mockMvc
        .perform(get("/api/v1/style-presets").param("category", "VISUAL_STYLE"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data[0].name").value("Cinematic Warmth"))
        .andExpect(jsonPath("$.data[0].category").value("VISUAL_STYLE"))
        .andExpect(
            jsonPath("$.data[0].description")
                .value("Warm cinematic lighting with grounded texture."))
        .andExpect(
            jsonPath("$.data[0].thumbnail").value("https://example.test/cinematic-warmth.jpg"))
        .andExpect(jsonPath("$.data[0].tags[0]").value("cinematic"))
        .andExpect(jsonPath("$.data[0].id").doesNotExist())
        .andExpect(jsonPath("$.data[0].createdAt").doesNotExist())
        .andExpect(jsonPath("$.data[0].promptSuffix").doesNotExist())
        .andExpect(jsonPath("$.data[0].negativePrompt").doesNotExist())
        .andExpect(jsonPath("$.data[0].configJson").doesNotExist());

    verify(listCatalogUseCase).stylePresets("VISUAL_STYLE");
  }
}
