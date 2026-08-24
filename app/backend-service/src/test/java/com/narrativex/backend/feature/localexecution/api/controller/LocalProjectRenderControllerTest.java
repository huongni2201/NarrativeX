package com.narrativex.backend.feature.localexecution.api.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.assets.application.port.in.MediaStorageAccess;
import com.narrativex.backend.feature.localexecution.application.port.out.LocalProjectRenderStore;
import com.narrativex.backend.feature.localexecution.application.usecase.LocalProjectRenderUseCase;
import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class LocalProjectRenderControllerTest {
  @Test
  void claimIncludesSignedUrlsForImmutableSnapshotAssets() {
    var useCase = mock(LocalProjectRenderUseCase.class);
    var storage = mock(MediaStorageAccess.class);
    var controller = new LocalProjectRenderController(useCase, storage);
    UUID jobId = UUID.randomUUID();
    UUID projectId = UUID.randomUUID();
    UUID storyVersionId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    UUID narrationAssetId = UUID.randomUUID();
    UUID visualBeatId = UUID.randomUUID();
    UUID imageAssetId = UUID.randomUUID();

    var claim =
        new LocalProjectRenderStore.ClaimedProjectRender(
            UUID.randomUUID(),
            jobId,
            projectId,
            storyVersionId,
            "1080p",
            "mp4",
            "RATIO_16_9",
            10_000L,
            "{}",
            UUID.randomUUID(),
            List.of(
                new LocalProjectRenderStore.ChapterInput(
                    chapterId,
                    0,
                    0L,
                    10_000L,
                    narrationAssetId,
                    "narration/chapter-1.wav",
                    1_024L,
                    "a".repeat(64),
                    10_000L)),
            List.of(
                new LocalProjectRenderStore.BeatInput(
                    chapterId,
                    0,
                    0,
                    visualBeatId,
                    imageAssetId,
                    0L,
                    10_000L,
                    10_000L,
                    "NONE",
                    "images/beat-1.png",
                    2_048L,
                    "b".repeat(64))));
    when(useCase.claim("device-token")).thenReturn(Optional.of(claim));
    when(storage.createDownloadUrl(eq("narration/chapter-1.wav"), any(Instant.class)))
        .thenReturn(URI.create("https://assets.example.test/narration.wav?signature=audio"));
    when(storage.createDownloadUrl(eq("images/beat-1.png"), any(Instant.class)))
        .thenReturn(URI.create("https://assets.example.test/beat.png?signature=image"));

    var response = controller.claim("device-token");

    assertThat(response.getBody()).isNotNull();
    var data = response.getBody().data();
    assertThat(data.jobId()).isEqualTo(jobId);
    assertThat(data.chapters()).hasSize(1);
    assertThat(data.chapters().get(0).downloadUrl())
        .isEqualTo("https://assets.example.test/narration.wav?signature=audio");
    assertThat(data.beats()).hasSize(1);
    assertThat(data.beats().get(0).downloadUrl())
        .isEqualTo("https://assets.example.test/beat.png?signature=image");
  }
}
