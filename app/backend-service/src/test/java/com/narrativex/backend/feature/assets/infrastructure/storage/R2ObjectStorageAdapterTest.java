package com.narrativex.backend.feature.assets.infrastructure.storage;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.URI;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class R2ObjectStorageAdapterTest {
  private static final String SHA = "a".repeat(64);

  @Test
  void presignUsesCommandRemainingLifetimeMinusSafetyMargin() {
    R2ObjectStorageAdapter adapter =
        new R2ObjectStorageAdapter(
            new R2StorageProperties("account", "access", "secret", "bucket", "https://example.com"));

    var upload =
        adapter.createUpload(
            new ObjectStoragePort.CreateUpload(
                "media/uploads/test", "audio/mpeg", 128, SHA, Instant.now().plusSeconds(120)));

    String expires = URI.create(upload.uploadUrl().toString()).getQuery().replaceAll(".*X-Amz-Expires=([^&]+).*", "$1");
    assertThat(Long.parseLong(expires)).isBetween(100L, 120L);
  }

  @Test
  void doesNotSignWhenOnlySafetyMarginRemains() {
    R2ObjectStorageAdapter adapter =
        new R2ObjectStorageAdapter(
            new R2StorageProperties("account", "access", "secret", "bucket", "https://example.com"));

    org.assertj.core.api.Assertions.assertThatThrownBy(
            () ->
                adapter.createUpload(
                    new ObjectStoragePort.CreateUpload(
                        "media/uploads/test", "audio/mpeg", 128, SHA, Instant.now().plusSeconds(5))))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void headDoesNotSetRestrictedHostHeader() throws Exception {
    HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    try {
      server.createContext(
          "/",
          exchange -> {
            assertThat(exchange.getRequestMethod()).isEqualTo("HEAD");
            exchange.getResponseHeaders().set("Content-Type", "audio/mpeg");
            exchange.getResponseHeaders().set("Content-Length", "0");
            exchange
                .getResponseHeaders()
                .set(
                    "x-amz-checksum-sha256",
                    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
            exchange.sendResponseHeaders(200, -1);
            exchange.close();
          });
      server.start();

      R2StorageProperties properties =
          new R2StorageProperties(
              "account",
              "access",
              "secret",
              "bucket",
              "http://127.0.0.1:" + server.getAddress().getPort());

      ObjectStoragePort.StoredObject object =
          new R2ObjectStorageAdapter(properties).head("media/uploads/test");

      assertThat(object.contentType()).isEqualTo("audio/mpeg");
    } finally {
      server.stop(0);
    }
  }

  @Test
  void headComputesChecksumWhenR2DoesNotReturnChecksumMetadata() throws Exception {
    byte[] body = "abc".getBytes(java.nio.charset.StandardCharsets.UTF_8);
    HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    try {
      server.createContext(
          "/",
          exchange -> {
            exchange.getResponseHeaders().set("Content-Type", "audio/mpeg");
            if ("HEAD".equals(exchange.getRequestMethod())) {
              exchange.getResponseHeaders().set("Content-Length", String.valueOf(body.length));
              exchange.sendResponseHeaders(200, -1);
            } else {
              assertThat(exchange.getRequestMethod()).isEqualTo("GET");
              exchange.sendResponseHeaders(200, body.length);
              exchange.getResponseBody().write(body);
            }
            exchange.close();
          });
      server.start();

      R2StorageProperties properties =
          new R2StorageProperties(
              "account",
              "access",
              "secret",
              "bucket",
              "http://127.0.0.1:" + server.getAddress().getPort());

      ObjectStoragePort.StoredObject object =
          new R2ObjectStorageAdapter(properties).head("media/uploads/test");

      assertThat(object.sizeBytes()).isEqualTo(body.length);
      assertThat(object.contentType()).isEqualTo("audio/mpeg");
      assertThat(object.sha256())
          .isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    } finally {
      server.stop(0);
    }
  }
}
