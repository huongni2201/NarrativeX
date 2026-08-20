package com.narrativex.backend.feature.generation.application.service;

import java.math.BigDecimal;

public record NarrationCostEstimate(
    long characters,
    BigDecimal estimateMin,
    BigDecimal estimateMax,
    BigDecimal maxAuthorizedCost) {}
