package com.narrativex.backend.feature.render.infrastructure.storage;

import static org.assertj.core.api.Assertions.assertThat;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class GoogleDriveArtifactContentAdapterTest {
  @Test
  void refreshesOAuthAndStreamsRequestedRangeWithoutBufferingTheArtifact() throws Exception {
    AtomicInteger tokenRequests = new AtomicInteger();
    AtomicReference<String> authorization = new AtomicReference<>();
    AtomicReference<String> range = new AtomicReference<>();
    HttpServer server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
    server.createContext(
        "/token",
        exchange -> {
          tokenRequests.incrementAndGet();
          respond(
              exchange,
              200,
              "{\"access_token\":\"access-1\",\"expires_in\":3600}",
              "application/json");
        });
    server.createContext(
        "/drive/v3/files/file-123",
        exchange -> {
          authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
          range.set(exchange.getRequestHeaders().getFirst("Range"));
          byte[] content = "23456".getBytes(StandardCharsets.UTF_8);
          exchange.getResponseHeaders().set("Content-Range", "bytes 2-6/10");
          exchange.getResponseHeaders().set("Content-Length", String.valueOf(content.length));
          exchange.getResponseHeaders().set("Content-Type", "video/mp4");
          exchange.sendResponseHeaders(206, content.length);
          try (var body = exchange.getResponseBody()) {
            body.write(content);
          }
        });
    server.start();

    try {
      GoogleDriveArtifactContentProperties properties =
          new GoogleDriveArtifactContentProperties("client", "secret", "refresh", "folder", 10);
      GoogleDriveArtifactContentAdapter adapter =
          new GoogleDriveArtifactContentAdapter(
              properties,
              JsonMapper.builder().build(),
              HttpClient.newHttpClient(),
              URI.create("http://localhost:" + server.getAddress().getPort() + "/token"),
              URI.create("http://localhost:" + server.getAddress().getPort() + "/drive/v3/files"));

      var content = adapter.read("file-123", 2L, 6L);
      assertThat(content.partial()).isTrue();
      assertThat(content.contentLength()).isEqualTo(5L);
      assertThat(content.totalLength()).isEqualTo(10L);
      assertThat(content.contentRangeHeader()).isEqualTo("bytes 2-6/10");
      assertThat(new String(content.content().readAllBytes(), StandardCharsets.UTF_8))
          .isEqualTo("23456");
      content.content().close();
      assertThat(authorization).hasValue("Bearer access-1");
      assertThat(range).hasValue("bytes=2-6");

      var secondRead = adapter.read("file-123", null, null);
      secondRead.content().close();
      assertThat(tokenRequests).hasValue(1);
    } finally {
      server.stop(0);
    }
  }

  private static void respond(HttpExchange exchange, int status, String body, String contentType)
      throws IOException {
    byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().set("Content-Type", contentType);
    exchange.sendResponseHeaders(status, bytes.length);
    try (var responseBody = exchange.getResponseBody()) {
      responseBody.write(bytes);
    }
  }
}
