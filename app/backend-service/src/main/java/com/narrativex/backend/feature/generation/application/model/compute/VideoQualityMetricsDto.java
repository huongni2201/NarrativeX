package com.narrativex.backend.feature.generation.application.model.compute;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/** Raw worker measurements of a take. Thresholds and verdicts are owned by the backend. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record VideoQualityMetricsDto(
    @JsonProperty("status") String status,
    @JsonProperty("scorerVersion") String scorerVersion,
    @JsonProperty("reason") String reason,
    @JsonProperty("freezeHeadMs") Long freezeHeadMs,
    @JsonProperty("freezeTotalMs") Long freezeTotalMs,
    @JsonProperty("motionMean") Double motionMean,
    @JsonProperty("sceneCutCount") Integer sceneCutCount,
    @JsonProperty("flickerStddev") Double flickerStddev,
    @JsonProperty("blackTotalMs") Long blackTotalMs,
    @JsonProperty("silenceTotalMs") Long silenceTotalMs,
    @JsonProperty("integratedLufs") Double integratedLufs,
    @JsonProperty("peakDbfs") Double peakDbfs,
    @JsonProperty("meanY") Double meanY,
    @JsonProperty("meanU") Double meanU,
    @JsonProperty("meanV") Double meanV) {

  public boolean measured() {
    return "MEASURED".equals(status);
  }
}
