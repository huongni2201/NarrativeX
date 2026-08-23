package com.narrativex.backend.feature.render.infrastructure.storage;

import com.narrativex.backend.feature.render.application.port.in.ArtifactContentRange;
import com.narrativex.backend.feature.render.application.port.out.FinalArtifactContentPort;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Reads local final MP4s written by the E2E worker and preserves HTTP range semantics. */
@Component
@ConditionalOnProperty(
    prefix = "narrativex.storage",
    name = "final-video-mode",
    havingValue = "local")
public class LocalFinalArtifactContentAdapter implements FinalArtifactContentPort {
  private final Path root;

  public LocalFinalArtifactContentAdapter(
      @Value("${narrativex.storage.final-video-local-dir:/tmp/narrativex-e2e/final}") String root) {
    this.root = Path.of(root).toAbsolutePath().normalize();
  }

  @Override
  public ArtifactContentRange read(String externalFileId, Long start, Long end) {
    Path path = Path.of(Objects.requireNonNull(externalFileId)).toAbsolutePath().normalize();
    if (!path.startsWith(root) || !Files.isRegularFile(path)) {
      throw new IllegalStateException("Local final artifact was not found");
    }
    try {
      long totalLength = Files.size(path);
      long rangeStart = start == null ? 0 : start;
      long rangeEnd = end == null ? totalLength - 1 : Math.min(end, totalLength - 1);
      if (rangeStart < 0 || rangeStart >= totalLength || rangeEnd < rangeStart) {
        throw new IllegalArgumentException("Requested artifact range is invalid");
      }
      InputStream input = Files.newInputStream(path);
      input.skipNBytes(rangeStart);
      long length = rangeEnd - rangeStart + 1;
      InputStream bounded = new BoundedInputStream(input, length);
      return new ArtifactContentRange(
          bounded,
          length,
          start == null ? null : rangeStart,
          start == null ? null : rangeEnd,
          start == null ? totalLength : totalLength,
          start != null);
    } catch (IOException exception) {
      throw new IllegalStateException("Local final artifact could not be opened", exception);
    }
  }

  private static final class BoundedInputStream extends InputStream {
    private final InputStream delegate;
    private long remaining;

    private BoundedInputStream(InputStream delegate, long remaining) {
      this.delegate = delegate;
      this.remaining = remaining;
    }

    @Override
    public int read() throws IOException {
      if (remaining == 0) return -1;
      int value = delegate.read();
      if (value >= 0) remaining--;
      return value;
    }

    @Override
    public int read(byte[] bytes, int offset, int length) throws IOException {
      if (remaining == 0) return -1;
      int read = delegate.read(bytes, offset, (int) Math.min(length, remaining));
      if (read > 0) remaining -= read;
      return read;
    }

    @Override
    public void close() throws IOException {
      delegate.close();
    }
  }
}
