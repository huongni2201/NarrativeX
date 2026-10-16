package com.narrativex.backend.feature.catalog.api.controller;

import com.narrativex.backend.feature.catalog.api.request.CreateCustomVoiceRequest;
import com.narrativex.backend.feature.catalog.api.response.CatalogResponse;
import com.narrativex.backend.feature.catalog.application.command.CreateCustomVoiceCommand;
import com.narrativex.backend.feature.catalog.application.usecase.ManageCustomVoiceUseCase;
import com.narrativex.backend.feature.common.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/voices")
public class CustomVoiceController {
  private static final String DEFAULT_LANGUAGE = "vi-VN";

  private final ManageCustomVoiceUseCase useCase;

  @PostMapping("/custom")
  public ResponseEntity<ApiResponse<CatalogResponse.Voice>> create(
      @Valid @RequestBody CreateCustomVoiceRequest request) {
    String language =
        request.language() == null || request.language().isBlank()
            ? DEFAULT_LANGUAGE
            : request.language().trim();
    var voice =
        useCase.create(
            new CreateCustomVoiceCommand(
                request.name(),
                language,
                request.gender(),
                request.description(),
                request.referenceAssetId()));
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ApiResponse.success("Custom voice created", CatalogResponse.Voice.from(voice)));
  }

  @DeleteMapping("/custom/{id}")
  public ResponseEntity<ApiResponse<Void>> delete(@PathVariable String id) {
    useCase.delete(id);
    return ResponseEntity.ok(ApiResponse.success("Custom voice removed"));
  }
}
