package com.narrativex.backend.feature.assets.infrastructure.storage;

import static org.assertj.core.api.Assertions.assertThat;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.time.Duration;
import org.junit.jupiter.api.Test;

class R2ObjectStorageAdapterTest {
  @Test
  void headDoesNotSetRestrictedHostHeader() throws Exception {
    HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    try {
      server.createContext(
          "/",
          exchange -> {
            assertThat(exchange.getRequestMethod()).isEqualTo("HEAD");
            exchange.getResponseHeaders().set("Content-Type", "audio/mpeg");
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
              "http://127.0.0.1:" + server.getAddress().getPort(),
              Duration.ofMinutes(15));

      ObjectStoragePort.StoredObject object =
          new R2ObjectStorageAdapter(properties).head("media/uploads/test");

      assertThat(object.contentType()).isEqualTo("audio/mpeg");
    } finally {
      server.stop(0);
    }
  }
}
