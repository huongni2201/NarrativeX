package com.narrativex.backend.feature.storyboard.domain.entity;

import com.narrativex.backend.feature.common.domain.DomainEntity;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Models audience tension curves, curiosity loops, and attention pacing across a chapter. */
public final class RetentionMap extends DomainEntity {
  private final UUID chapterId;
  private final String tensionCurveJson;
  private final String openQuestionsJson;
  private final String resolvedQuestionsJson;
  private final String pacingWarningsJson;
  private final List<AttentionEvent> attentionEvents;

  public RetentionMap(
      UUID chapterId,
      String tensionCurveJson,
      String openQuestionsJson,
      String resolvedQuestionsJson,
      String pacingWarningsJson,
      List<AttentionEvent> attentionEvents) {
    this(
        null,
        0L,
        chapterId,
        tensionCurveJson,
        openQuestionsJson,
        resolvedQuestionsJson,
        pacingWarningsJson,
        attentionEvents);
  }

  public RetentionMap(
      UUID id,
      long rowVersion,
      UUID chapterId,
      String tensionCurveJson,
      String openQuestionsJson,
      String resolvedQuestionsJson,
      String pacingWarningsJson,
      List<AttentionEvent> attentionEvents) {
    super(id, rowVersion);
    this.chapterId = Objects.requireNonNull(chapterId, "chapterId must not be null");
    this.tensionCurveJson = tensionCurveJson != null ? tensionCurveJson.trim() : "[]";
    this.openQuestionsJson = openQuestionsJson != null ? openQuestionsJson.trim() : "[]";
    this.resolvedQuestionsJson = resolvedQuestionsJson != null ? resolvedQuestionsJson.trim() : "[]";
    this.pacingWarningsJson = pacingWarningsJson != null ? pacingWarningsJson.trim() : "[]";
    this.attentionEvents =
        attentionEvents != null
            ? Collections.unmodifiableList(new ArrayList<>(attentionEvents))
            : Collections.emptyList();
  }

  public UUID getChapterId() {
    return chapterId;
  }

  public String getTensionCurveJson() {
    return tensionCurveJson;
  }

  public String getOpenQuestionsJson() {
    return openQuestionsJson;
  }

  public String getResolvedQuestionsJson() {
    return resolvedQuestionsJson;
  }

  public String getPacingWarningsJson() {
    return pacingWarningsJson;
  }

  public List<AttentionEvent> getAttentionEvents() {
    return attentionEvents;
  }
}
