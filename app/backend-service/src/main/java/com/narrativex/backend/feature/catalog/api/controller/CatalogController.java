package com.narrativex.backend.feature.catalog.api.controller;

import com.narrativex.backend.feature.catalog.api.response.CatalogResponse;
import com.narrativex.backend.feature.catalog.application.usecase.ListCatalogUseCase;
import com.narrativex.backend.feature.common.response.ApiResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1")
public class CatalogController {
  private final ListCatalogUseCase listCatalogUseCase;

  @GetMapping("/style-presets")
  public ResponseEntity<ApiResponse<List<CatalogResponse.StylePreset>>> stylePresets(
      @RequestParam(required = false) String category) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Style presets retrieved successfully",
            listCatalogUseCase.stylePresets(category).stream()
                .map(CatalogResponse.StylePreset::from)
                .toList()));
  }

  @GetMapping("/voices")
  public ResponseEntity<ApiResponse<List<CatalogResponse.Voice>>> voices(
      @RequestParam(required = false) String language) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Voice catalog retrieved successfully",
            listCatalogUseCase.voices(language).stream()
                .map(CatalogResponse.Voice::from)
                .toList()));
  }
}
