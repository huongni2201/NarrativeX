package com.narrativex.backend.feature.assets.api.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.narrativex.backend.feature.assets.infrastructure.storage.ProjectLocalMediaAccess;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class ProjectLocalMediaControllerTest {
  @TempDir Path tempDir;

  private ProjectLocalMediaAccess mediaAccess;
  private MockMvc mockMvc;
  private String mediaPath;

  @BeforeEach
  void setUp() throws Exception {
    mediaAccess = new ProjectLocalMediaAccess(tempDir.toString(), "http://localhost:8080");
    Path audio = tempDir.resolve("narration/request-1/chapter.mp3");
    Files.createDirectories(audio.getParent());
    Files.write(audio, new byte[] {0, 1, 2, 3, 4, 5, 6, 7, 8, 9});

    URI url =
        mediaAccess.createDownloadUrl(
            "narration/request-1/chapter.mp3", Instant.now().plusSeconds(60));
    mediaPath = url.getPath();
    mockMvc = MockMvcBuilders.standaloneSetup(new ProjectLocalMediaController(mediaAccess)).build();
  }

  @Test
  void servesSingleByteRangeForChromiumAudioPlayback() throws Exception {
    mockMvc
        .perform(get(mediaPath).header(HttpHeaders.RANGE, "bytes=2-5"))
        .andExpect(status().isPartialContent())
        .andExpect(header().string(HttpHeaders.ACCEPT_RANGES, "bytes"))
        .andExpect(header().string(HttpHeaders.CONTENT_RANGE, "bytes 2-5/10"))
        .andExpect(header().longValue(HttpHeaders.CONTENT_LENGTH, 4L))
        .andExpect(content().bytes(new byte[] {2, 3, 4, 5}));
  }

  @Test
  void headReturnsAudioMetadataWithoutBody() throws Exception {
    mockMvc
        .perform(head(mediaPath))
        .andExpect(status().isOk())
        .andExpect(header().string(HttpHeaders.ACCEPT_RANGES, "bytes"))
        .andExpect(header().longValue(HttpHeaders.CONTENT_LENGTH, 10L))
        .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "audio/mpeg"))
        .andExpect(content().bytes(new byte[0]));
  }
}
