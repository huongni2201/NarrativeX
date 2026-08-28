package com.narrativex.backend.feature.assets.infrastructure.storage;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

/** Capability-token access to generated project media on the shared local filesystem. */
@Component
public class ProjectLocalMediaAccess {
  private static final String NARRATION_PREFIX = "narration/";
  private static final String PROVIDER_RESULTS_PREFIX = "private/provider-results/";

  private final Path root;
  private final URI publicBaseUrl;
  private final Map<String, Ticket> tickets = new ConcurrentHashMap<>();

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
        || storageKey.startsWith(PROVIDER_RESULTS_PREFIX);
  }

  public URI createDownloadUrl(String storageKey, Instant expiresAt) {
    if (!supports(storageKey)) {
      throw new IllegalArgumentException("Unsupported project-local media key");
    }
    if (expiresAt == null || !expiresAt.isAfter(Instant.now())) {
      throw new IllegalArgumentException("Project-local download URL must expire in the future");
    }
    resolvePath(storageKey, true);
    String token = UUID.randomUUID().toString();
    tickets.put(token, new Ticket(storageKey, expiresAt));
    return URI.create(publicBaseUrl + "/api/v1/local-media/" + token);
  }

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

  private Path resolvePath(String storageKey, boolean requireExistingFile) {
    if (!supports(storageKey)) throw new IllegalArgumentException("Unsupported project-local media key");
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

  private record Ticket(String storageKey, Instant expiresAt) {}

  public record LocalMediaFile(
      Resource resource, MediaType contentType, long sizeBytes, String filename) {}
}
