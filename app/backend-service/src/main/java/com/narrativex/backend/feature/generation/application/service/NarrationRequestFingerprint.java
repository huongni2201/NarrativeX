package com.narrativex.backend.feature.generation.application.service;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class NarrationRequestFingerprint {
  public String calculate(
      UUID chapterId,
      long chapterRowVersion,
      String sourceHash,
      String voiceId,
      String language,
      BigDecimal speakingRate,
      String segmentationVersion) {
    return calculate(
        chapterId,
        chapterRowVersion,
        sourceHash,
        voiceId,
        language,
        speakingRate,
        segmentationVersion,
        null,
        null);
  }

  public String calculate(
      UUID chapterId,
      long chapterRowVersion,
      String sourceHash,
      String voiceId,
      String language,
      BigDecimal speakingRate,
      String segmentationVersion,
      UUID voiceReferenceAssetId) {
    return calculate(
        chapterId,
        chapterRowVersion,
        sourceHash,
        voiceId,
        language,
        speakingRate,
        segmentationVersion,
        voiceReferenceAssetId,
        null);
  }

  public String calculate(
      UUID chapterId,
      long chapterRowVersion,
      String sourceHash,
      String voiceId,
      String language,
      BigDecimal speakingRate,
      String segmentationVersion,
      UUID voiceReferenceAssetId,
      UUID contentVariantId) {
    String payload =
        String.join(
            "|",
            chapterId.toString(),
            Long.toString(chapterRowVersion),
            sourceHash,
            voiceId,
            language,
            speakingRate.stripTrailingZeros().toPlainString(),
            segmentationVersion,
            voiceReferenceAssetId == null ? "" : voiceReferenceAssetId.toString(),
            contentVariantId == null ? "original" : contentVariantId.toString());
    try {
      byte[] digest =
          MessageDigest.getInstance("SHA-256").digest(payload.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(digest);
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 must be available in the JDK", exception);
    }
  }
}
