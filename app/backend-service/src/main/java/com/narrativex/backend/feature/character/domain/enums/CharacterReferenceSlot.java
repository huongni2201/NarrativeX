package com.narrativex.backend.feature.character.domain.enums;

public enum CharacterReferenceSlot {
  FACE_FRONT("IDENTITY", 0),
  FACE_THREE_QUARTER_LEFT("PROFILE", 1),
  FACE_THREE_QUARTER_RIGHT("PROFILE", 2),
  FACE_PROFILE_LEFT("PROFILE", 3),
  FACE_PROFILE_RIGHT("PROFILE", 4),
  BODY_FRONT("POSE", 5),
  BODY_SIDE("POSE", 6),
  BODY_BACK("POSE", 7);

  private final String role;
  private final int priority;

  CharacterReferenceSlot(String role, int priority) {
    this.role = role;
    this.priority = priority;
  }

  public String role() {
    return role;
  }

  public int priority() {
    return priority;
  }
}
