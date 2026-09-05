package com.narrativex.backend.feature.generation.application.service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/** Stable API projection for append-only continuity report JSON. */
@Component
@RequiredArgsConstructor
public final class ContinuityIssueCodec {
  private final ObjectMapper objectMapper;

  public List<Issue> decode(String issuesJson) {
    if (issuesJson == null || issuesJson.isBlank()) return List.of();
    try {
      @SuppressWarnings("unchecked")
      Map<String, Object>[] values = objectMapper.readValue(issuesJson, Map[].class);
      List<Issue> issues = new ArrayList<>(values.length);
      for (int index = 0; index < values.length; index++) {
        Map<String, Object> value = values[index];
        issues.add(
            new Issue(
                "issue-" + (index + 1),
                string(value.get("code")),
                string(value.get("severity")),
                stringList(value.get("scopeKeys")),
                stringList(value.get("evidenceAnchors")),
                string(value.get("message")),
                string(value.get("origin")),
                value));
      }
      return List.copyOf(issues);
    } catch (Exception exception) {
      throw new IllegalStateException("Could not parse continuity report issues", exception);
    }
  }

  public String encodeRaw(List<Issue> issues) {
    try {
      return objectMapper.writeValueAsString(issues.stream().map(Issue::raw).toList());
    } catch (Exception exception) {
      throw new IllegalStateException("Could not serialize continuity report issues", exception);
    }
  }

  private static String string(Object value) {
    return value == null ? "" : value.toString();
  }

  private static List<String> stringList(Object value) {
    if (value instanceof List<?> list) return list.stream().map(Object::toString).toList();
    if (value instanceof Object[] array) return Arrays.stream(array).map(Object::toString).toList();
    return List.of();
  }

  public record Issue(
      String id,
      String code,
      String severity,
      List<String> scopeKeys,
      List<String> evidenceAnchors,
      String message,
      String origin,
      Map<String, Object> raw) {
    public Issue {
      scopeKeys = List.copyOf(scopeKeys);
      evidenceAnchors = List.copyOf(evidenceAnchors);
      raw = Map.copyOf(raw);
    }
  }
}
