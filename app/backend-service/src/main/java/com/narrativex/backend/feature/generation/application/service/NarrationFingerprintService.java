package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.domain.value.NarrationDocumentChapter;
import com.narrativex.backend.feature.generation.domain.value.NarrationPartSnapshot;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import org.springframework.stereotype.Component;

/** Stable identities for immutable narration inputs. Order is deliberately part of the payload. */
@Component
public class NarrationFingerprintService {
  public String narrationFingerprint(List<NarrationPartSnapshot> parts) {
    String payload =
        parts.stream()
            .map(part -> part.sequence() + ":" + part.sha256())
            .reduce((left, right) -> left + "|" + right)
            .orElse("");
    return sha256(payload);
  }

  public String documentFingerprint(List<NarrationDocumentChapter> chapters) {
    String payload =
        chapters.stream()
            .map(
                chapter ->
                    chapter.sequence()
                        + ":"
                        + chapter.chapterRevisionId()
                        + ":"
                        + chapter.sourceHash())
            .reduce((left, right) -> left + "|" + right)
            .orElse("");
    return sha256(payload);
  }

  private static String sha256(String payload) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256")
                  .digest(payload.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 must be available in the JDK", exception);
    }
  }
}
