package com.narrativex.backend.feature.render.infrastructure.storage;

import com.narrativex.backend.feature.common.exception.FeatureNotAvailableException;
import com.narrativex.backend.feature.render.application.port.out.ArtifactContentRange;
import com.narrativex.backend.feature.render.application.port.out.FinalArtifactContentPort;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Streams private Google Drive media through the backend using the worker's OAuth credentials. */
@Component
@ConditionalOnProperty(
    prefix = "narrativex.storage", name = "final-video-mode", havingValue = "google-drive", matchIfMissing = true)
public class GoogleDriveArtifactContentAdapter implements FinalArtifactContentPort {
  private static final URI TOKEN_ENDPOINT = URI.create("https://oauth2.googleapis.com/token");
  private static final URI DRIVE_ENDPOINT = URI.create("https://www.googleapis.com/drive/v3/files");
  private static final Pattern CONTENT_RANGE =
      Pattern.compile("bytes\\s+(\\d+)-(\\d+)/(\\d+|\\*)", Pattern.CASE_INSENSITIVE);
  private static final long TOKEN_SAFETY_MARGIN_SECONDS = 60;

  private final GoogleDriveArtifactContentProperties properties;
  private final ObjectMapper objectMapper;
  private final HttpClient httpClient;
  private final URI tokenEndpoint;
  private final URI driveEndpoint;
  private volatile CachedAccessToken cachedAccessToken;

  @Autowired
  public GoogleDriveArtifactContentAdapter(
      GoogleDriveArtifactContentProperties properties, ObjectMapper objectMapper) {
    this(
        properties,
        objectMapper,
        HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(Math.max(1, properties.timeoutSeconds())))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .version(HttpClient.Version.HTTP_1_1)
            .build(),
        TOKEN_ENDPOINT,
        DRIVE_ENDPOINT);
  }

  GoogleDriveArtifactContentAdapter(
      GoogleDriveArtifactContentProperties properties,
      ObjectMapper objectMapper,
      HttpClient httpClient,
      URI tokenEndpoint,
      URI driveEndpoint) {
    this.properties = properties;
    this.objectMapper = objectMapper;
    this.httpClient = httpClient;
    this.tokenEndpoint = tokenEndpoint;
    this.driveEndpoint = driveEndpoint;
  }

  @Override
  public ArtifactContentRange read(String externalFileId, Long start, Long end) {
    ensureConfigured();
    if (externalFileId == null || externalFileId.isBlank()) {
      throw new IllegalArgumentException("externalFileId must not be blank");
    }
    if (start != null && start < 0)
      throw new IllegalArgumentException("start must not be negative");
    if (end != null && end < 0) throw new IllegalArgumentException("end must not be negative");
    if (start != null && end != null && end < start) {
      throw new IllegalArgumentException("end must not be before start");
    }

    HttpRequest.Builder request =
        HttpRequest.newBuilder(fileMediaUri(externalFileId))
            .timeout(Duration.ofSeconds(Math.max(1, properties.timeoutSeconds())))
            .header("Authorization", "Bearer " + accessToken())
            .header("Accept", "video/mp4")
            .GET();
    if (start != null) {
      request.header("Range", "bytes=" + start + "-" + (end == null ? "" : end));
    }

    HttpResponse<InputStream> response =
        send(request.build(), HttpResponse.BodyHandlers.ofInputStream());
    if (response.statusCode() == 404) {
      closeQuietly(response.body());
      throw new IllegalStateException("Google Drive final artifact was not found");
    }
    if (response.statusCode() < 200 || response.statusCode() >= 300) {
      closeQuietly(response.body());
      throw new IllegalStateException(
          "Google Drive media request failed with status " + response.statusCode());
    }

    boolean partial = response.statusCode() == 206;
    String contentRangeHeader = response.headers().firstValue("Content-Range").orElse(null);
    Range responseRange = parseContentRange(contentRangeHeader);
    if (start != null && !partial) {
      closeQuietly(response.body());
      throw new IllegalStateException("Google Drive did not honor the requested byte range");
    }
    Long contentLength =
        parseLongHeader(response.headers().firstValue("Content-Length").orElse(null));
    if (contentLength == null && responseRange != null) {
      contentLength = responseRange.end() - responseRange.start() + 1;
    }
    Long rangeStart = responseRange == null ? (partial ? start : null) : responseRange.start();
    Long rangeEnd = responseRange == null ? end : responseRange.end();
    Long totalLength = responseRange == null ? contentLength : responseRange.totalLength();
    return new ArtifactContentRange(
        response.body(), contentLength, rangeStart, rangeEnd, totalLength, partial);
  }

  private String accessToken() {
    CachedAccessToken current = cachedAccessToken;
    if (current != null
        && current.expiresAt().isAfter(Instant.now().plusSeconds(TOKEN_SAFETY_MARGIN_SECONDS))) {
      return current.value();
    }
    synchronized (this) {
      current = cachedAccessToken;
      if (current != null
          && current.expiresAt().isAfter(Instant.now().plusSeconds(TOKEN_SAFETY_MARGIN_SECONDS))) {
        return current.value();
      }
      cachedAccessToken = refreshAccessToken();
      return cachedAccessToken.value();
    }
  }

  private CachedAccessToken refreshAccessToken() {
    String form =
        "client_id="
            + formEncode(properties.clientId())
            + "&client_secret="
            + formEncode(properties.clientSecret())
            + "&refresh_token="
            + formEncode(properties.refreshToken())
            + "&grant_type=refresh_token";
    HttpRequest request =
        HttpRequest.newBuilder(tokenEndpoint)
            .timeout(Duration.ofSeconds(Math.max(1, properties.timeoutSeconds())))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString(form))
            .build();
    HttpResponse<String> response = send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() < 200 || response.statusCode() >= 300) {
      throw new IllegalStateException(
          "Google OAuth token refresh failed with status " + response.statusCode());
    }
    try {
      JsonNode json = objectMapper.readTree(response.body());
      String token = json.path("access_token").asText("");
      if (token.isBlank())
        throw new IllegalStateException("Google OAuth response did not contain an access token");
      long expiresIn = Math.max(1, json.path("expires_in").asLong(3600));
      return new CachedAccessToken(token, Instant.now().plusSeconds(expiresIn));
    } catch (JacksonException exception) {
      throw new IllegalStateException("Google OAuth token response could not be parsed", exception);
    }
  }

  private URI fileMediaUri(String externalFileId) {
    return URI.create(
        driveEndpoint.toString().replaceAll("/$", "")
            + "/"
            + formEncode(externalFileId)
            + "?alt=media");
  }

  private <T> HttpResponse<T> send(HttpRequest request, HttpResponse.BodyHandler<T> bodyHandler) {
    try {
      return httpClient.send(request, bodyHandler);
    } catch (IOException exception) {
      throw new IllegalStateException("Google Drive request failed", exception);
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Google Drive request was interrupted", exception);
    }
  }

  private void ensureConfigured() {
    if (!properties.configured()) {
      throw new FeatureNotAvailableException("Google Drive artifact storage is not configured");
    }
  }

  private static Range parseContentRange(String value) {
    if (value == null || value.isBlank()) return null;
    Matcher matcher = CONTENT_RANGE.matcher(value.trim());
    if (!matcher.matches() || "*".equals(matcher.group(3))) return null;
    try {
      return new Range(
          Long.parseLong(matcher.group(1)),
          Long.parseLong(matcher.group(2)),
          Long.parseLong(matcher.group(3)));
    } catch (NumberFormatException ignored) {
      return null;
    }
  }

  private static Long parseLongHeader(String value) {
    if (value == null || value.isBlank()) return null;
    try {
      long parsed = Long.parseLong(value.trim());
      return parsed >= 0 ? parsed : null;
    } catch (NumberFormatException ignored) {
      return null;
    }
  }

  private static String formEncode(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }

  private static void closeQuietly(InputStream stream) {
    try {
      stream.close();
    } catch (IOException ignored) {
      // The upstream error is more useful than a close failure.
    }
  }

  private record CachedAccessToken(String value, Instant expiresAt) {}

  private record Range(long start, long end, long totalLength) {}
}
