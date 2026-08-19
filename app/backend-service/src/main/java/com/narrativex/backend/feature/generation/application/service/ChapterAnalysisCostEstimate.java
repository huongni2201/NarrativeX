package com.narrativex.backend.feature.generation.application.service;

import java.math.BigDecimal;

public record ChapterAnalysisCostEstimate(
    int estimatedTokens,
    BigDecimal estimateMin,
    BigDecimal estimateMax,
    BigDecimal maxAuthorizedCost) {}
