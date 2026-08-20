package com.narrativex.backend.feature.generation.application.service;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import org.springframework.stereotype.Component;

@Component
public class NarrationRequestFingerprint {
  public String calculate(
      Long chapterId,
      long chapterRowVersion,
      String sourceHash,
      String voiceId,
      String language,
      BigDecimal speakingRate,
      String segmentationVersion) {
    String payload =
        String.join(
            "|",
            chapterId.toString(),
            Long.toString(chapterRowVersion),
            sourceHash,
            voiceId,
            language,
            speakingRate.stripTrailingZeros().toPlainString(),
            segmentationVersion);
    try {
      byte[] digest =
          MessageDigest.getInstance("SHA-256").digest(payload.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(digest);
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 must be available in the JDK", exception);
    }
  }
}
