package com.narrativex.backend.configuration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "narrativex.limits")
public class NarrativeXLimitsProperties {

  private int maxStoryCharacters = 500_000;
  private int maxConcurrentExpensiveJobs = 2;
  private boolean narrationEnabled = true;
  private boolean storyAnalysisEnabled = true;
  private boolean renderEnabled = true;

  public int getMaxStoryCharacters() {
    return maxStoryCharacters;
  }

  public void setMaxStoryCharacters(int maxStoryCharacters) {
    this.maxStoryCharacters = maxStoryCharacters;
  }

  public int getMaxConcurrentExpensiveJobs() {
    return maxConcurrentExpensiveJobs;
  }

  public void setMaxConcurrentExpensiveJobs(int maxConcurrentExpensiveJobs) {
    this.maxConcurrentExpensiveJobs = maxConcurrentExpensiveJobs;
  }

  public boolean isNarrationEnabled() {
    return narrationEnabled;
  }

  public void setNarrationEnabled(boolean narrationEnabled) {
    this.narrationEnabled = narrationEnabled;
  }

  public boolean isStoryAnalysisEnabled() {
    return storyAnalysisEnabled;
  }

  public void setStoryAnalysisEnabled(boolean storyAnalysisEnabled) {
    this.storyAnalysisEnabled = storyAnalysisEnabled;
  }

  public boolean isRenderEnabled() {
    return renderEnabled;
  }

  public void setRenderEnabled(boolean renderEnabled) {
    this.renderEnabled = renderEnabled;
  }
}
