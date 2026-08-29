package com.narrativex.backend.feature.assets.api.controller;

import com.narrativex.backend.feature.assets.api.request.RegisterLocalAssetRequest;
import com.narrativex.backend.feature.assets.api.response.MediaAssetDownloadUrlResponse;
import com.narrativex.backend.feature.assets.api.response.MediaAssetResponse;
import com.narrativex.backend.feature.assets.application.port.in.MediaStorageAccess;
import com.narrativex.backend.feature.assets.application.usecase.AssetLibraryUseCase;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.response.ApiResponse;
import jakarta.validation.Valid;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/assets")
public class AssetLibraryController {
  private final AssetLibraryUseCase useCase;
  private final MediaStorageAccess mediaStorageAccess;

  @GetMapping
  public ResponseEntity<ApiResponse<MediaAssetResponse.Page>> list(
      @RequestParam UUID projectId,
      @RequestParam(required = false) String type,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String search,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "50") int limit) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Assets retrieved successfully",
            MediaAssetResponse.Page.from(useCase.list(projectId, type, status, search, cursor, limit))));
  }

  @GetMapping("/{id}")
  public ResponseEntity<ApiResponse<MediaAssetResponse>> get(
      @PathVariable UUID id, @RequestParam UUID projectId) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Asset retrieved successfully", MediaAssetResponse.from(useCase.find(projectId, id))));
  }

  /**
   * Short-lived transport URL for project-local worker/provider output. This is not an R2 project
   * storage fallback; the storage key routes through the project-local media transport.
   */
  @GetMapping("/{id}/download-url")
  public ResponseEntity<ApiResponse<MediaAssetDownloadUrlResponse>> downloadUrl(
      @PathVariable UUID id, @RequestParam UUID projectId) {
    var asset = useCase.find(projectId, id);
    if (!"READY".equals(asset.status()) || asset.storageKey() == null || asset.storageKey().isBlank()) {
      throw new ResourceNotFoundException("Asset transport is not available");
    }
    Instant expiresAt = Instant.now().plus(Duration.ofMinutes(10));
    return ResponseEntity.ok(
        ApiResponse.success(
            "Asset transport URL created",
            new MediaAssetDownloadUrlResponse(
                mediaStorageAccess.createDownloadUrl(asset.storageKey(), expiresAt).toString(),
                expiresAt,
                asset.contentType(),
                asset.originalFilename())));
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
                        request.projectId(),
                        request.type(),
                        request.originalFilename(),
                        request.contentType(),
                        request.sizeBytes(),
                        request.checksumSha256(),
                        request.durationMs()))));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<ApiResponse<Void>> delete(
      @PathVariable UUID id, @RequestParam UUID projectId) {
    useCase.delete(projectId, id);
    return ResponseEntity.ok(ApiResponse.success("Asset deleted"));
  }
}
