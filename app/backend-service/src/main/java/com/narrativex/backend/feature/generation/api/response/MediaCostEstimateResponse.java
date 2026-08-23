package com.narrativex.backend.feature.generation.api.response;

public record MediaCostEstimateResponse(
    int visualBeatCount, String unitEstimatedCost, String estimatedCost, String currency) {}
