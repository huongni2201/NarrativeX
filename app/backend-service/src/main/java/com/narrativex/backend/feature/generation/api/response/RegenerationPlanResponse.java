package com.narrativex.backend.feature.generation.api.response;

import com.narrativex.backend.feature.generation.application.query.RegenerationPlanView;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record RegenerationPlanResponse(
    UUID regenerationPlanId,
    UUID continuityPlanId,
    List<UUID> affectedBeatIds,
    List<UUID> reusableBeatIds,
    String estimatedCost,
    String currency,
    Instant expiresAt,
    String inputFingerprint) {
  public static RegenerationPlanResponse from(RegenerationPlanView plan) {
    return new RegenerationPlanResponse(
        plan.id(),
        plan.continuityPlanId(),
        plan.affectedBeatIds(),
        plan.reusableBeatIds(),
        plan.estimatedCost().toPlainString(),
        plan.currency(),
        plan.expiresAt(),
        plan.inputFingerprint());
  }
}
