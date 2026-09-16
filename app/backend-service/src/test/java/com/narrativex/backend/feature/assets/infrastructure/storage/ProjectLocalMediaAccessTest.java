package com.narrativex.backend.feature.assets.infrastructure.storage;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class ProjectLocalMediaAccessTest {
  @Test
  void uploadsAtomicallyAndExposesIntegrityMetadata(
      @org.junit.jupiter.api.io.TempDir java.nio.file.Path tempDir) {
    ProjectLocalMediaAccess access = new ProjectLocalMediaAccess(tempDir.toString(), "");
    byte[] content = "artifact-bytes".getBytes(StandardCharsets.UTF_8);

    URI uploadUrl =
        access.createUploadUrl(
            "private/provider-results/task/attempt/output.json",
            "application/json",
            1024,
            Instant.now().plusSeconds(60),
            URI.create("http://backend:8080"));
    String token = uploadUrl.getPath().substring(uploadUrl.getPath().lastIndexOf('/') + 1);

    var uploaded = access.upload(token, new ByteArrayInputStream(content), "application/json");

    assertEquals(content.length, uploaded.sizeBytes());
    assertEquals("application/json", uploaded.contentType());
    assertEquals(access.inspect(uploaded.storageKey()).sha256(), uploaded.sha256());
    assertArrayEquals(content, access.readBytes(uploaded.storageKey(), 1024));
  }
}
