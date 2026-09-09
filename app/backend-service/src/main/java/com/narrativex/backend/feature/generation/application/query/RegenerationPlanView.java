package com.narrativex.backend.feature.generation.application.query;

import com.narrativex.backend.feature.generation.application.port.out.ChapterContinuityRepository.RegenerationPlan;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record RegenerationPlanView(
    UUID id,
    UUID continuityPlanId,
    List<UUID> requestedBeatIds,
    List<UUID> affectedBeatIds,
    List<UUID> reusableBeatIds,
    String reason,
    Instant expiresAt,
    String inputFingerprint) {
  public static RegenerationPlanView from(RegenerationPlan plan) {
    return new RegenerationPlanView(
        plan.id(),
        plan.continuityPlanId(),
        plan.requestedBeatIds(),
        plan.affectedBeatIds(),
        plan.reusableBeatIds(),
        plan.reason(),
        plan.expiresAt(),
        plan.inputFingerprint());
  }
}
