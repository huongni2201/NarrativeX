package com.narrativex.backend.feature.assets.api.controller;

import com.narrativex.backend.feature.assets.api.request.CreateUploadIntentRequest;
import com.narrativex.backend.feature.assets.api.request.RegisterLocalAssetRequest;
import com.narrativex.backend.feature.assets.api.response.MediaAssetDownloadUrlResponse;
import com.narrativex.backend.feature.assets.api.response.MediaAssetResponse;
import com.narrativex.backend.feature.assets.api.response.UploadFinalizeResponse;
import com.narrativex.backend.feature.assets.api.response.UploadIntentResponse;
import com.narrativex.backend.feature.assets.application.command.CreateUploadIntentCommand;
import com.narrativex.backend.feature.assets.application.port.in.MediaStorageAccess;
import com.narrativex.backend.feature.assets.application.usecase.AssetLibraryUseCase;
import com.narrativex.backend.feature.assets.application.usecase.MediaUploadUseCase;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.response.ApiResponse;
import jakarta.validation.Valid;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/assets")
public class AssetLibraryController {
  private final AssetLibraryUseCase useCase;
  private final MediaUploadUseCase mediaUploadUseCase;
  private final MediaStorageAccess mediaStorageAccess;

  @GetMapping
  public ResponseEntity<ApiResponse<MediaAssetResponse.Page>> list(
      @RequestParam(required = false) String type,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String search,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "50") int limit) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Assets retrieved successfully",
            MediaAssetResponse.Page.from(useCase.list(type, status, search, cursor, limit))));
  }

  @GetMapping("/{id}")
  public ResponseEntity<ApiResponse<MediaAssetResponse>> get(@PathVariable UUID id) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Asset retrieved successfully", MediaAssetResponse.from(useCase.find(id))));
  }

  @GetMapping("/{id}/download-url")
  public ResponseEntity<ApiResponse<MediaAssetDownloadUrlResponse>> downloadUrl(
      @PathVariable UUID id) {
    var asset = useCase.find(id);
    if (!"READY".equals(asset.status()) || "LOCAL_ONLY".equals(asset.origin())) {
      throw new ResourceNotFoundException("Asset is not available for download");
    }
    Instant expiresAt = Instant.now().plus(Duration.ofMinutes(10));
    return ResponseEntity.ok(
        ApiResponse.success(
            "Asset download URL created",
            new MediaAssetDownloadUrlResponse(
                mediaStorageAccess.createDownloadUrl(asset.storageKey(), expiresAt).toString(),
                expiresAt,
                asset.contentType(),
                asset.originalFilename())));
  }

  @PostMapping("/upload-intents")
  public ResponseEntity<ApiResponse<UploadIntentResponse>> createUploadIntent(
      @Valid @RequestBody CreateUploadIntentRequest request,
      @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Upload intent created",
            UploadIntentResponse.from(
                mediaUploadUseCase.createIntent(
                    new CreateUploadIntentCommand(
                        request.type(),
                        request.originalFilename(),
                        request.contentType(),
                        request.expectedSizeBytes(),
                        request.expectedSha256()),
                    idempotencyKey))));
  }

  @PostMapping("/local")
  public ResponseEntity<ApiResponse<MediaAssetResponse>> registerLocal(
      @Valid @RequestBody RegisterLocalAssetRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(
            ApiResponse.success(
                "Local asset registered",
                MediaAssetResponse.from(
                    useCase.registerLocal(
                        request.type(),
                        request.originalFilename(),
                        request.contentType(),
                        request.sizeBytes(),
                        request.checksumSha256(),
                        request.durationMs()))));
  }

  @PostMapping("/upload-intents/{id}/finalize")
  public ResponseEntity<ApiResponse<UploadFinalizeResponse>> finalizeUpload(@PathVariable UUID id) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Upload finalized",
            UploadFinalizeResponse.from(mediaUploadUseCase.finalizeUpload(id))));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
    useCase.delete(id);
    return ResponseEntity.ok(ApiResponse.success("Asset deleted"));
  }
}
