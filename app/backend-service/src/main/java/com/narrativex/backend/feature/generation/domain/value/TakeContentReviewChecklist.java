package com.narrativex.backend.feature.generation.domain.value;

/** Human review gates required before a Take can become the selected edit. */
public record TakeContentReviewChecklist(
    boolean characterWardrobe,
    boolean settingContinuity,
    boolean actionMotion,
    boolean dialogueVoice,
    boolean lipSync) {

  public boolean isComplete() {
    return characterWardrobe && settingContinuity && actionMotion && dialogueVoice && lipSync;
  }

  public String toJson() {
    return "{"
        + "\"characterWardrobe\":"
        + characterWardrobe
        + ",\"settingContinuity\":"
        + settingContinuity
        + ",\"actionMotion\":"
        + actionMotion
        + ",\"dialogueVoice\":"
        + dialogueVoice
        + ",\"lipSync\":"
        + lipSync
        + "}";
  }
}
