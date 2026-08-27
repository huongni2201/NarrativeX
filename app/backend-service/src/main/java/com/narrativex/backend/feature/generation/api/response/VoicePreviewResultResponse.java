package com.narrativex.backend.feature.generation.api.response;

import com.narrativex.backend.feature.generation.application.usecase.GetVoicePreviewResultUseCase;
import java.time.Instant;

public record VoicePreviewResultResponse(
    String url, Instant expiresAt, String contentType, long durationMs) {
  public static VoicePreviewResultResponse from(GetVoicePreviewResultUseCase.Result result) {
    return new VoicePreviewResultResponse(
        result.url(), result.expiresAt(), result.contentType(), result.durationMs());
  }
}
