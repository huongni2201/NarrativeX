package com.narrativex.backend.feature.assets.api.response;

import com.narrativex.backend.feature.assets.application.query.UploadFinalizeView;
import java.util.UUID;

public record UploadFinalizeResponse(UUID uploadSessionId, String status, UUID mediaAssetId) {
  public static UploadFinalizeResponse from(UploadFinalizeView view) {
    return new UploadFinalizeResponse(
        view.uploadSessionId(), view.status(), view.mediaAssetId());
  }
}
