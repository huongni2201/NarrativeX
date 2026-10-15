package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import java.time.Duration;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Settings for the lane-based outbox dispatcher. {@code parallelEnabled} stays {@code false} until
 * the parallel path has passed the full verification gate; the sequential dispatcher is the safe
 * default.
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "narrativex.generation.dispatch")
public class GenerationDispatchProperties {
  private boolean parallelEnabled = false;
  private Lanes lanes = new Lanes();

  /** Initial reservation taken while rows are handed to a lane. */
  private Duration reservation = Duration.ofSeconds(30);

  /** Lease after hand-off: provider timeout (900s) plus two minutes of margin. */
  private Duration analysisLease = Duration.ofMinutes(17);

  private Duration mediaLease = Duration.ofMinutes(5);
  private Duration shutdownTimeout = Duration.ofSeconds(30);

  @Getter
  @Setter
  public static class Lanes {
    private int analysis = 2;
    private int media = 4;
  }

  public int capacity(DispatchLane lane) {
    int configured = lane == DispatchLane.ANALYSIS ? lanes.getAnalysis() : lanes.getMedia();
    return Math.max(1, configured);
  }

  public Duration lease(DispatchLane lane) {
    return lane == DispatchLane.ANALYSIS ? analysisLease : mediaLease;
  }
}
