package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import java.math.BigDecimal;
import java.util.UUID;

public record NarrationRequestRow(
    UUID id,
    Long projectId,
    Long chapterId,
    long chapterRowVersion,
    String sourceHash,
    String sourceText,
    String voiceId,
    String language,
    BigDecimal speakingRate,
    String segmentationVersion,
    String requestFingerprint) {}
