package com.narrativex.backend.feature.assets.infrastructure.storage;

import com.narrativex.backend.feature.assets.application.port.in.LocalMediaUploadAccess;
import com.narrativex.backend.feature.assets.application.port.in.MediaStorageAccess;
import com.narrativex.backend.feature.assets.application.port.in.MediaStorageAccess.LocalMediaFile;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

/** Capability-token access to generated project media on the shared local filesystem. */
@Component
public class ProjectLocalMediaAccess implements MediaStorageAccess, LocalMediaUploadAccess {
  private static final String NARRATION_PREFIX = "narration/";
  private static final String PROVIDER_RESULTS_PREFIX = "private/provider-results/";
  private static final String PROJECTS_SEGMENT = "projects";
  private static final String PROJECT_ASSETS_SEGMENT = "assets";

  private final Path root;
  private final URI publicBaseUrl;
  private final Map<String, Ticket> tickets = new ConcurrentHashMap<>();
  private final Map<String, UploadTicket> uploadTickets = new ConcurrentHashMap<>();

  public ProjectLocalMediaAccess(
      @Value("${narrativex.storage.project-media-local-dir:/data/narrativex/project-media}")
          String projectMediaLocalDir,
      @Value("${narrativex.security.public-base-url:}") String publicBaseUrl) {
    this.root = Path.of(projectMediaLocalDir).toAbsolutePath().normalize();
    String normalizedBase = publicBaseUrl == null ? "" : publicBaseUrl.trim();
    if (normalizedBase.isBlank()) normalizedBase = "http://localhost:8080";
    this.publicBaseUrl = URI.create(normalizedBase.replaceAll("/$", ""));
  }

  public boolean supports(String storageKey) {
    if (storageKey == null) return false;
    return storageKey.startsWith(NARRATION_PREFIX)
        || storageKey.startsWith(PROVIDER_RESULTS_PREFIX)
        || isProjectAssetKey(storageKey);
  }

  private static boolean isProjectAssetKey(String storageKey) {
    if (storageKey.indexOf('\\') >= 0) return false;
    String[] segments = storageKey.split("/", -1);
    if (segments.length < 4
        || !PROJECTS_SEGMENT.equals(segments[0])
        || !PROJECT_ASSETS_SEGMENT.equals(segments[2])) {
      return false;
    }
    for (String segment : segments) {
      if (segment.isBlank() || ".".equals(segment) || "..".equals(segment)) return false;
    }
    try {
      UUID.fromString(segments[1]);
      return true;
    } catch (IllegalArgumentException ignored) {
      return false;
    }
  }

  @Override
  public URI createDownloadUrl(String storageKey, Instant expiresAt) {
    return createDownloadUrl(storageKey, expiresAt, publicBaseUrl);
  }

  public URI createDownloadUrl(String storageKey, Instant expiresAt, URI baseUrl) {
    if (!supports(storageKey)) {
      throw new IllegalArgumentException("Unsupported project-local media key");
    }
    if (expiresAt == null || !expiresAt.isAfter(Instant.now())) {
      throw new IllegalArgumentException("Project-local download URL must expire in the future");
    }
    resolvePath(storageKey, true);
    String token = UUID.randomUUID().toString();
    tickets.put(token, new Ticket(storageKey, expiresAt));
    return URI.create(trimBaseUrl(baseUrl) + "/api/v1/local-media/" + token);
  }

  public URI createUploadUrl(
      String storageKey, String contentType, long maxBytes, Instant expiresAt, URI baseUrl) {
    if (!supports(storageKey)) {
      throw new IllegalArgumentException("Unsupported project-local media key");
    }
    if (contentType == null || contentType.isBlank()) {
      throw new IllegalArgumentException("Upload content type is required");
    }
    if (maxBytes <= 0) {
      throw new IllegalArgumentException("Upload maxBytes must be positive");
    }
    if (expiresAt == null || !expiresAt.isAfter(Instant.now())) {
      throw new IllegalArgumentException("Project-local upload URL must expire in the future");
    }
    resolvePath(storageKey, false);
    String token = UUID.randomUUID().toString();
    uploadTickets.put(token, new UploadTicket(storageKey, contentType, maxBytes, expiresAt));
    return URI.create(trimBaseUrl(baseUrl) + "/api/v1/local-media/" + token);
  }

  @Override
  public LocalMediaFile resolve(String token) {
    Ticket ticket = tickets.get(token);
    if (ticket == null) throw new IllegalArgumentException("Unknown local media token");
    if (!ticket.expiresAt().isAfter(Instant.now())) {
      tickets.remove(token, ticket);
      throw new IllegalArgumentException("Expired local media token");
    }
    Path path = resolvePath(ticket.storageKey(), true);
    return new LocalMediaFile(
        new FileSystemResource(path),
        contentType(path),
        fileSize(path),
        path.getFileName().toString());
  }

  @Override
  public UploadedMedia upload(String token, InputStream body, String contentType) {
    UploadTicket ticket = uploadTickets.get(token);
    if (ticket == null) throw new IllegalArgumentException("Unknown local media upload token");
    if (!ticket.expiresAt().isAfter(Instant.now())) {
      uploadTickets.remove(token, ticket);
      throw new IllegalArgumentException("Expired local media upload token");
    }
    if (contentType == null || !contentType.equalsIgnoreCase(ticket.contentType())) {
      throw new IllegalArgumentException("Uploaded content type does not match capability");
    }

    Path target = resolvePath(ticket.storageKey(), false);
    try {
      Files.createDirectories(target.getParent());
      Path temporary = Files.createTempFile(target.getParent(), ".compute-upload-", ".part");
      try {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        long size = 0L;
        byte[] buffer = new byte[8192];
        try (InputStream input = body;
            OutputStream output = Files.newOutputStream(temporary)) {
          int read;
          while ((read = input.read(buffer)) != -1) {
            if (read == 0) continue;
            size += read;
            if (size > ticket.maxBytes()) {
              throw new IllegalArgumentException("Uploaded artifact exceeds capability limit");
            }
            digest.update(buffer, 0, read);
            output.write(buffer, 0, read);
          }
        }
        if (size <= 0) throw new IllegalArgumentException("Uploaded artifact is empty");
        moveIntoPlace(temporary, target);
        uploadTickets.remove(token, ticket);
        return new UploadedMedia(
            ticket.storageKey(),
            size,
            ticket.contentType(),
            HexFormat.of().formatHex(digest.digest()));
      } catch (RuntimeException | IOException exception) {
        Files.deleteIfExists(temporary);
        throw exception;
      }
    } catch (IOException exception) {
      throw new IllegalStateException("Project-local media upload failed", exception);
    } catch (java.security.NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is unavailable", exception);
    }
  }

  public UploadedMedia inspect(String storageKey) {
    Path path = resolvePath(storageKey, true);
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      long size = 0L;
      try (InputStream input = Files.newInputStream(path)) {
        byte[] buffer = new byte[8192];
        int read;
        while ((read = input.read(buffer)) != -1) {
          if (read == 0) continue;
          digest.update(buffer, 0, read);
          size += read;
        }
      }
      return new UploadedMedia(
          storageKey,
          size,
          contentType(path).toString(),
          HexFormat.of().formatHex(digest.digest()));
    } catch (IOException exception) {
      throw new IllegalStateException("Project-local media inspection failed", exception);
    } catch (java.security.NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is unavailable", exception);
    }
  }

  public byte[] readBytes(String storageKey, long maxBytes) {
    Path path = resolvePath(storageKey, true);
    try {
      long size = Files.size(path);
      if (size <= 0 || size > maxBytes || size > Integer.MAX_VALUE) {
        throw new IllegalArgumentException("Project-local artifact exceeds read limit");
      }
      return Files.readAllBytes(path);
    } catch (IOException exception) {
      throw new IllegalStateException("Project-local media read failed", exception);
    }
  }

  private Path resolvePath(String storageKey, boolean requireExistingFile) {
    if (!supports(storageKey))
      throw new IllegalArgumentException("Unsupported project-local media key");
    Path candidate = root.resolve(storageKey).normalize();
    if (!candidate.startsWith(root)) {
      throw new IllegalArgumentException("Project-local media key escapes configured root");
    }
    if (requireExistingFile && !Files.isRegularFile(candidate)) {
      throw new IllegalArgumentException("Project-local media file is unavailable");
    }
    return candidate;
  }

  private static long fileSize(Path path) {
    try {
      return Files.size(path);
    } catch (IOException exception) {
      throw new IllegalStateException("Project-local media size is unavailable", exception);
    }
  }

  private static MediaType contentType(Path path) {
    String filename = path.getFileName().toString().toLowerCase();
    if (filename.endsWith(".mp3")) return MediaType.parseMediaType("audio/mpeg");
    if (filename.endsWith(".wav")) return MediaType.parseMediaType("audio/wav");
    if (filename.endsWith(".png")) return MediaType.IMAGE_PNG;
    if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) return MediaType.IMAGE_JPEG;
    if (filename.endsWith(".webp")) return MediaType.parseMediaType("image/webp");
    if (filename.endsWith(".mp4")) return MediaType.parseMediaType("video/mp4");
    try {
      String detected = Files.probeContentType(path);
      if (detected != null && !detected.isBlank()) return MediaType.parseMediaType(detected);
    } catch (IOException | IllegalArgumentException ignored) {
      // Fall back to binary for uncommon project-local formats.
    }
    return MediaType.APPLICATION_OCTET_STREAM;
  }

  private static void moveIntoPlace(Path temporary, Path target) throws IOException {
    try {
      Files.move(
          temporary, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
    } catch (AtomicMoveNotSupportedException exception) {
      Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING);
    }
  }

  private static String trimBaseUrl(URI baseUrl) {
    if (baseUrl == null || baseUrl.toString().isBlank()) {
      throw new IllegalArgumentException("Capability base URL is required");
    }
    return baseUrl.toString().replaceAll("/$", "");
  }

  private record Ticket(String storageKey, Instant expiresAt) {}

  private record UploadTicket(
      String storageKey, String contentType, long maxBytes, Instant expiresAt) {}
}
