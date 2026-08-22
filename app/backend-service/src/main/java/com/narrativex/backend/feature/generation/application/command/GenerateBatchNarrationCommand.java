package com.narrativex.backend.feature.generation.application.command;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record GenerateBatchNarrationCommand(
    Long projectId,
    List<Long> chapterIds,
    String voiceId,
    BigDecimal speakingRate,
    UUID voiceReferenceAssetId) {}
