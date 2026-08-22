package com.narrativex.backend.feature.assets.infrastructure.storage;

import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort;
import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort.CreateUpload;
import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort.PresignedUpload;
import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort.StoredObject;
import com.narrativex.backend.feature.common.exception.FeatureNotAvailableException;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** S3-compatible Cloudflare R2 adapter; credentials remain infrastructure-only. */
@Component
@RequiredArgsConstructor
public class R2ObjectStorageAdapter implements ObjectStoragePort {
  private static final String REGION = "auto";
  private static final String SERVICE = "s3";
  private static final String UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";
  private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);
  private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(15);
  private static final DateTimeFormatter AMZ_DATE =
      DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC);
  private static final DateTimeFormatter SHORT_DATE =
      DateTimeFormatter.ofPattern("yyyyMMdd").withZone(ZoneOffset.UTC);

  private final R2StorageProperties properties;
  private final HttpClient httpClient =
      HttpClient.newBuilder().connectTimeout(CONNECT_TIMEOUT).version(HttpClient.Version.HTTP_1_1).build();
  private final Clock clock = Clock.systemUTC();

  @Override
  public PresignedUpload createUpload(CreateUpload command) {
    ensureConfigured();
    Instant now = Instant.now(clock);
    String amzDate = AMZ_DATE.format(now);
    String shortDate = SHORT_DATE.format(now);
    String credential = properties.accessKeyId().trim() + "/" + shortDate + "/" + REGION + "/" + SERVICE + "/aws4_request";
    String checksumHeader = base64Checksum(command.checksumSha256());
    String signedHeaders = "host;x-amz-checksum-sha256";
    Map<String, String> query =
        new TreeMap<>(
            Map.of(
                "X-Amz-Algorithm", "AWS4-HMAC-SHA256",
                "X-Amz-Credential", credential,
                "X-Amz-Date", amzDate,
                "X-Amz-Expires", String.valueOf(properties.presignDuration().toSeconds()),
                "X-Amz-SignedHeaders", signedHeaders));
    URI objectUri = objectUri(command.storageKey());
    String canonicalQuery = canonicalQuery(query);
    String canonicalRequest =
        "PUT\n"
            + canonicalPath(objectUri) + "\n"
            + canonicalQuery + "\n"
            + "host:" + host(objectUri) + "\n"
            + "x-amz-checksum-sha256:" + checksumHeader + "\n\n"
            + signedHeaders + "\n"
            + UNSIGNED_PAYLOAD;
    String scope = shortDate + "/" + REGION + "/" + SERVICE + "/aws4_request";
    query.put(
        "X-Amz-Signature",
        hex(hmac(signingKey(shortDate), "AWS4-HMAC-SHA256\n" + amzDate + "\n" + scope + "\n" + sha256(canonicalRequest))));
    return new PresignedUpload(
        command.storageKey(),
        withQuery(objectUri, query),
        command.expiresAt(),
        Map.of("x-amz-checksum-sha256", checksumHeader));
  }

  @Override
  public StoredObject head(String storageKey) {
    HttpResponse<byte[]> response = sendSigned("HEAD", storageKey, HttpRequest.BodyPublishers.noBody());
    if (response.statusCode() == 404) throw new ObjectStoragePort.ObjectNotFoundException(storageKey);
    if (response.statusCode() < 200 || response.statusCode() >= 300) {
      throw new IllegalStateException("Object storage HEAD request failed with status " + response.statusCode());
    }
    long size =
        response.headers().firstValue("content-length")
            .map(R2ObjectStorageAdapter::parseSize)
            .orElse(-1L);
    String contentType =
        normalizeContentType(response.headers().firstValue("content-type").orElse(""));
    String checksum = response.headers().firstValue("x-amz-checksum-sha256").orElse(null);
    if (checksum != null) checksum = decodeChecksum(checksum);
    return new StoredObject(storageKey, size, contentType, checksum);
  }

  @Override
  public void delete(String storageKey) {
    HttpResponse<byte[]> response = sendSigned("DELETE", storageKey, HttpRequest.BodyPublishers.noBody());
    if (response.statusCode() == 404) return;
    if (response.statusCode() < 200 || response.statusCode() >= 300) {
      throw new IllegalStateException("Object storage DELETE request failed with status " + response.statusCode());
    }
  }

  private HttpResponse<byte[]> sendSigned(
      String method, String storageKey, HttpRequest.BodyPublisher body) {
    ensureConfigured();
    URI uri = objectUri(storageKey);
    Instant now = Instant.now(clock);
    String amzDate = AMZ_DATE.format(now);
    String shortDate = SHORT_DATE.format(now);
    String payloadHash = sha256Hex(new byte[0]);
    String canonicalHeaders =
        "host:" + host(uri) + "\n" + "x-amz-content-sha256:" + payloadHash + "\n" + "x-amz-date:" + amzDate + "\n";
    String signedHeaders = "host;x-amz-content-sha256;x-amz-date";
    String canonicalRequest =
        method + "\n"
            + canonicalPath(uri) + "\n\n"
            + canonicalHeaders + "\n"
            + signedHeaders + "\n"
            + payloadHash;
    String scope = shortDate + "/" + REGION + "/" + SERVICE + "/aws4_request";
    String authorization =
        "AWS4-HMAC-SHA256 Credential="
            + properties.accessKeyId().trim() + "/" + scope
            + ", SignedHeaders=" + signedHeaders
            + ", Signature="
            + hex(hmac(signingKey(shortDate), "AWS4-HMAC-SHA256\n" + amzDate + "\n" + scope + "\n" + sha256(canonicalRequest)));
    // java.net.http derives the restricted Host header from the request URI.
    HttpRequest request =
        HttpRequest.newBuilder(uri)
            .timeout(REQUEST_TIMEOUT)
            .header("x-amz-date", amzDate)
            .header("x-amz-content-sha256", payloadHash)
            .header("Authorization", authorization)
            .method(method, body)
            .build();
    try {
      return httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
    } catch (IOException exception) {
      throw new IllegalStateException("Object storage request failed", exception);
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Object storage request was interrupted", exception);
    }
  }

  private URI objectUri(String storageKey) {
    URI endpoint = URI.create(properties.effectiveEndpoint());
    String path = trimTrailingSlash(endpoint.getPath()) + "/" + awsEncode(properties.bucket().trim()) + "/" + encodePath(storageKey);
    return URI.create(endpoint.getScheme() + "://" + endpoint.getRawAuthority() + path);
  }

  private byte[] signingKey(String shortDate) {
    byte[] dateKey = hmac(("AWS4" + properties.secretAccessKey().trim()).getBytes(StandardCharsets.UTF_8), shortDate);
    byte[] regionKey = hmac(dateKey, REGION);
    byte[] serviceKey = hmac(regionKey, SERVICE);
    return hmac(serviceKey, "aws4_request");
  }

  private static URI withQuery(URI uri, Map<String, String> query) {
    return URI.create(uri.toString() + "?" + canonicalQuery(query));
  }

  private static String canonicalQuery(Map<String, String> query) {
    List<String> values = new ArrayList<>();
    query.forEach((key, value) -> values.add(awsEncode(key) + "=" + awsEncode(value)));
    return String.join("&", values);
  }

  private static String canonicalPath(URI uri) {
    return uri.getRawPath().isBlank() ? "/" : uri.getRawPath();
  }

  private static String encodePath(String path) {
    return java.util.Arrays.stream(path.split("/", -1))
        .map(R2ObjectStorageAdapter::awsEncode)
        .collect(java.util.stream.Collectors.joining("/"));
  }

  private static String host(URI uri) {
    return uri.getRawAuthority();
  }

  private void ensureConfigured() {
    if (!properties.configured()) {
      throw new FeatureNotAvailableException("Object storage is not configured");
    }
  }

  private static String trimTrailingSlash(String value) {
    return value == null || value.isBlank() ? "" : value.replaceAll("/$", "");
  }

  private static String decodeChecksum(String checksum) {
    String normalized = checksum.trim();
    if (normalized.matches("^[0-9a-fA-F]{64}$")) return normalized.toLowerCase(Locale.ROOT);
    try {
      byte[] decoded = Base64.getDecoder().decode(normalized);
      if (decoded.length != 32) return normalized;
      return HexFormat.of().formatHex(decoded);
    } catch (IllegalArgumentException ignored) {
      return normalized;
    }
  }

  private static long parseSize(String value) {
    try {
      long size = Long.parseLong(value.trim());
      return size >= 0 ? size : -1L;
    } catch (NumberFormatException ignored) {
      return -1L;
    }
  }

  private static String normalizeContentType(String contentType) {
    int parametersStart = contentType.indexOf(';');
    String mediaType =
        parametersStart >= 0 ? contentType.substring(0, parametersStart) : contentType;
    return mediaType.trim().toLowerCase(Locale.ROOT);
  }

  private static String base64Checksum(String checksumHex) {
    try {
      return Base64.getEncoder().encodeToString(HexFormat.of().parseHex(checksumHex));
    } catch (IllegalArgumentException exception) {
      throw new IllegalArgumentException("checksumSha256 must be a 64-character hexadecimal SHA-256", exception);
    }
  }

  private static String awsEncode(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8)
        .replace("+", "%20")
        .replace("%7E", "~");
  }

  private static String sha256(String value) {
    return sha256Hex(value.getBytes(StandardCharsets.UTF_8));
  }

  private static String sha256Hex(byte[] value) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value));
    } catch (Exception exception) {
      throw new IllegalStateException("SHA-256 is unavailable", exception);
    }
  }

  private static byte[] hmac(byte[] key, String value) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(key, "HmacSHA256"));
      return mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
    } catch (Exception exception) {
      throw new IllegalStateException("HMAC-SHA256 is unavailable", exception);
    }
  }

  private static String hex(byte[] value) {
    return HexFormat.of().formatHex(value);
  }
}
