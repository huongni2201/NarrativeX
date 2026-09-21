package com.narrativex.backend.feature.storyboard.domain.entity;

import com.narrativex.backend.feature.common.domain.DomainEntity;
import java.util.Objects;
import java.util.UUID;

/** Pre-generation retention planning defining the narrative and visual hook of an episode. */
public final class HookPlan extends DomainEntity {
  private final UUID chapterId;
  private final String promise;
  private final String conflict;
  private final String curiosityQuestion;
  private final String visualHook;
  private final String dialogueHook;
  private final String withheldInformation;
  private final UUID payoffBeatId;

  public HookPlan(
      UUID chapterId,
      String promise,
      String conflict,
      String curiosityQuestion,
      String visualHook,
      String dialogueHook,
      String withheldInformation,
      UUID payoffBeatId) {
    this(
        null,
        0L,
        chapterId,
        promise,
        conflict,
        curiosityQuestion,
        visualHook,
        dialogueHook,
        withheldInformation,
        payoffBeatId);
  }

  public HookPlan(
      UUID id,
      long rowVersion,
      UUID chapterId,
      String promise,
      String conflict,
      String curiosityQuestion,
      String visualHook,
      String dialogueHook,
      String withheldInformation,
      UUID payoffBeatId) {
    super(id, rowVersion);
    this.chapterId = Objects.requireNonNull(chapterId, "chapterId must not be null");
    this.promise = promise != null ? promise.trim() : "";
    this.conflict = conflict != null ? conflict.trim() : "";
    this.curiosityQuestion = curiosityQuestion != null ? curiosityQuestion.trim() : "";
    this.visualHook = visualHook != null ? visualHook.trim() : "";
    this.dialogueHook = dialogueHook != null ? dialogueHook.trim() : "";
    this.withheldInformation = withheldInformation != null ? withheldInformation.trim() : "";
    this.payoffBeatId = payoffBeatId;
  }

  public UUID getChapterId() {
    return chapterId;
  }

  public String getPromise() {
    return promise;
  }

  public String getConflict() {
    return conflict;
  }

  public String getCuriosityQuestion() {
    return curiosityQuestion;
  }

  public String getVisualHook() {
    return visualHook;
  }

  public String getDialogueHook() {
    return dialogueHook;
  }

  public String getWithheldInformation() {
    return withheldInformation;
  }

  public UUID getPayoffBeatId() {
    return payoffBeatId;
  }
}
