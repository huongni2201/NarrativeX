package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.application.model.VoiceReferenceSelection;
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
      VoiceReferenceSelection voiceReference) {
    String voiceReferenceKey =
        voiceReference == null
            ? "voiceRef=NONE"
            : "voiceRef=" + voiceReference.scope().name() + ":" + voiceReference.assetId();
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
            voiceReferenceKey);
    try {
      byte[] digest =
          MessageDigest.getInstance("SHA-256").digest(payload.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(digest);
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 must be available in the JDK", exception);
    }
  }
}
