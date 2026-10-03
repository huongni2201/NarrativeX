package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.common.hashing.Sha256;
import com.narrativex.backend.feature.generation.application.model.VoiceReferenceSelection;
import java.math.BigDecimal;
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
    return Sha256.hexUtf8(payload);
  }
}
