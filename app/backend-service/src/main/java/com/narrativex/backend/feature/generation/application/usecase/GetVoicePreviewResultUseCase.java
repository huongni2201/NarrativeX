package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.assets.application.port.in.MediaStorageAccess;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.application.port.out.VoicePreviewResultAccess;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GetVoicePreviewResultUseCase {
  private final CurrentUserId currentUserId;
  private final VoicePreviewResultAccess resultAccess;
  private final MediaStorageAccess mediaStorageAccess;

  public Result execute(UUID projectId, UUID jobId) {
    var result = resultAccess.findCompleted(currentUserId.get(), projectId, jobId);
    Instant expiresAt = Instant.now().plus(Duration.ofMinutes(10));
    return new Result(
        mediaStorageAccess.createDownloadUrl(result.storageKey(), expiresAt).toString(),
        expiresAt,
        result.contentType(),
        result.durationMs());
  }

  public record Result(String url, Instant expiresAt, String contentType, long durationMs) {}
}
