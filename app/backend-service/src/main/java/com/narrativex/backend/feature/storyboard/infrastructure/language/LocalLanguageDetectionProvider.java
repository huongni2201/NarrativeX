package com.narrativex.backend.feature.storyboard.infrastructure.language;

import com.narrativex.backend.feature.storyboard.application.port.out.LanguageDetectionProvider;
import com.narrativex.backend.feature.storyboard.domain.value.LanguageDetectionResult;
import java.math.BigDecimal;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Component;

/** Fast, deterministic detector for the common clear-language path. */
@Component
public class LocalLanguageDetectionProvider implements LanguageDetectionProvider {
  private static final Set<String> VI_MARKERS =
      Set.of(" và ", " không ", " của ", " những ", " một ", " tôi ");
  private static final Set<String> EN_MARKERS =
      Set.of(" the ", " and ", " is ", " are ", " of ", " to ");

  @Override
  public LanguageDetectionResult detect(String content) {
    String normalized = " " + content.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ") + " ";
    if (normalized.trim().length() < 24) {
      return new LanguageDetectionResult("UNKNOWN", new BigDecimal("0.40"), "local-heuristic-v1");
    }
    long vi = VI_MARKERS.stream().filter(normalized::contains).count();
    long en = EN_MARKERS.stream().filter(normalized::contains).count();
    boolean vietnameseDiacritics = normalized.matches(".*[ăâđêôơưáàảãạấầẩẫậắằẳẵặ].*");
    if (vietnameseDiacritics || vi > en) {
      return new LanguageDetectionResult(
          "vi", confidence(Math.max(vi, 1), en), "local-heuristic-v1");
    }
    if (en > vi) {
      return new LanguageDetectionResult(
          "en", confidence(Math.max(en, 1), vi), "local-heuristic-v1");
    }
    return new LanguageDetectionResult(
        "MULTILINGUAL", new BigDecimal("0.55"), "local-heuristic-v1");
  }

  private static BigDecimal confidence(long winner, long other) {
    return BigDecimal.valueOf(Math.min(0.99, 0.70 + (winner - other) * 0.08)).setScale(2);
  }
}
