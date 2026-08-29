package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.assets.api.request.CreateUploadIntentRequest;
import com.narrativex.backend.feature.assets.api.response.UploadFinalizeResponse;
import com.narrativex.backend.feature.assets.api.response.UploadIntentResponse;
import com.narrativex.backend.feature.assets.application.command.CreateUploadIntentCommand;
import com.narrativex.backend.feature.assets.application.usecase.MediaUploadUseCase;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.response.VoiceReferenceAssetResponse;
import com.narrativex.backend.feature.generation.application.port.in.VoiceReferenceCatalog;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/voice-references")
public class VoiceReferenceUploadController {
  private final MediaUploadUseCase mediaUploadUseCase;
  private final VoiceReferenceCatalog getVoiceReferenceAssetUseCase;

  @GetMapping
  public ResponseEntity<ApiResponse<List<VoiceReferenceAssetResponse>>> list() {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Voice references retrieved",
            getVoiceReferenceAssetUseCase.list().stream()
                .map(VoiceReferenceAssetResponse::from)
                .toList()));
  }

  @GetMapping("/{id}")
  public ResponseEntity<ApiResponse<VoiceReferenceAssetResponse>> get(@PathVariable UUID id) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Voice reference retrieved",
            VoiceReferenceAssetResponse.from(getVoiceReferenceAssetUseCase.get(id))));
  }

  @PostMapping("/upload-intents")
  public ResponseEntity<ApiResponse<UploadIntentResponse>> createUploadIntent(
      @Valid @RequestBody CreateUploadIntentRequest request,
      @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Voice reference upload intent created",
            UploadIntentResponse.from(
                mediaUploadUseCase.createIntent(
                    new CreateUploadIntentCommand(
                        "AUDIO",
                        request.originalFilename(),
                        request.contentType(),
                        request.expectedSizeBytes(),
                        request.expectedSha256()),
                    idempotencyKey))));
  }

  @PostMapping("/upload-intents/{id}/finalize")
  public ResponseEntity<ApiResponse<UploadFinalizeResponse>> finalizeUpload(@PathVariable UUID id) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Voice reference upload finalized",
            UploadFinalizeResponse.from(mediaUploadUseCase.finalizeUpload(id))));
  }
}
