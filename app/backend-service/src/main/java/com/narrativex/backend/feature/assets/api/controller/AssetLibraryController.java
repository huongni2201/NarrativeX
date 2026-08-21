package com.narrativex.backend.feature.assets.api.controller;

import com.narrativex.backend.feature.assets.api.request.UploadMediaAssetRequest;
import com.narrativex.backend.feature.assets.api.response.MediaAssetResponse;
import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.assets.application.usecase.AssetLibraryUseCase;
import com.narrativex.backend.feature.common.response.ApiResponse;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
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

  @GetMapping
  public ResponseEntity<ApiResponse<List<MediaAssetResponse>>> list(
      @RequestParam(required = false) String type,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String search) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Assets retrieved successfully",
            useCase.list(type, status, search).stream().map(MediaAssetResponse::from).toList()));
  }

  /** Registers immutable media metadata; binary upload/finalization is owned by the media store. */
  @PostMapping("/upload")
  public ResponseEntity<ApiResponse<MediaAssetResponse>> upload(
      @Valid @RequestBody UploadMediaAssetRequest request) {
    UUID id = request.id() == null ? UUID.randomUUID() : request.id();
    MediaAssetResponse response =
        MediaAssetResponse.from(
            useCase.upload(
                new MediaAssetRepository.CreateMediaAsset(
                    id,
                    request.type(),
                    request.origin(),
                    request.storageKey(),
                    request.originalFilename(),
                    request.contentType(),
                    request.sizeBytes(),
                    request.sha256(),
                    request.durationMs())));
    return ResponseEntity.created(URI.create("/api/v1/assets/" + response.id()))
        .body(ApiResponse.success("Asset metadata registered", response));
  }

  @PostMapping("/{id}/approve")
  public ResponseEntity<ApiResponse<MediaAssetResponse>> approve(@PathVariable UUID id) {
    return ResponseEntity.ok(
        ApiResponse.success("Asset approved", MediaAssetResponse.from(useCase.approve(id))));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
    useCase.delete(id);
    return ResponseEntity.ok(ApiResponse.success("Asset deleted"));
  }
}
