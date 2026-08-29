package com.narrativex.backend.configuration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "narrativex.limits")
public class NarrativeXLimitsProperties {

  private int maxStoryCharacters = 500_000;

  public int getMaxStoryCharacters() {
    return maxStoryCharacters;
  }

  public void setMaxStoryCharacters(int maxStoryCharacters) {
    this.maxStoryCharacters = maxStoryCharacters;
  }
}
