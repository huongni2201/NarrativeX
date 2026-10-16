package com.narrativex.backend.feature.storyboard.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.feature.storyboard.application.service.SourceUnitSegmenter.SourceUnit;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;

class SourceUnitSegmenterTest {
  private static List<String> texts(String source) {
    return SourceUnitSegmenter.segment(source).stream().map(SourceUnit::text).toList();
  }

  @Test
  void splitsSentencesAndKeepsExactUtf16OffsetsIntoTheNormalizedSource() {
    String source = "😀 He said: Hello. She smiled! Why?\r\nNew line.";
    var units = SourceUnitSegmenter.segment(source);
    assertEquals(
        List.of("😀 He said: Hello.", "She smiled!", "Why?", "New line."),
        units.stream().map(SourceUnit::text).toList());
    String normalized = SourceUnitSegmenter.normalize(source);
    for (int index = 0; index < units.size(); index++) {
      SourceUnit unit = units.get(index);
      assertEquals(unit.text(), normalized.substring(unit.start(), unit.end()));
      assertEquals(index, unit.index());
    }
  }

  @Test
  void isDeterministic() {
    String source = "Một câu. Câu khác dài hơn một chút, có dấu phẩy! Hết?";
    assertEquals(SourceUnitSegmenter.segment(source), SourceUnitSegmenter.segment(source));
  }

  @Test
  void treatsEveryLineAsAHardBoundaryAndSkipsBlankLines() {
    assertEquals(List.of("Dòng một", "Dòng hai"), texts("Dòng một\n\n  \nDòng hai\n"));
  }

  @Test
  void keepsClosingQuotesWithTheirSentence() {
    assertEquals(List.of("\"Xin chào.\"", "Anh nói."), texts("\"Xin chào.\" Anh nói."));
  }

  @Test
  void doesNotSplitAfterAbbreviationsInitialsOrDecimals() {
    String source = "Ông V. A. đến TP. HCM lúc 3.5 giờ.";
    assertEquals(List.of(source), texts(source));
  }

  @Test
  void ellipsisBeforeALowercaseWordContinuesTheSentence() {
    assertEquals(List.of("Anh... đi đâu đó."), texts("Anh... đi đâu đó."));
    assertEquals(List.of("Anh...", "Đi đâu."), texts("Anh... Đi đâu."));
  }

  @Test
  void splitsOverLongSentencesAtClausesWithinTheCap() {
    String sentence = String.join(", ", Collections.nCopies(12, "một đoạn khá dài")) + ".";
    var units = SourceUnitSegmenter.segment(sentence);
    assertTrue(units.size() > 1);
    for (SourceUnit unit : units) {
      assertTrue(unit.text().length() <= SourceUnitSegmenter.MAX_UNIT_CHARS, unit.text());
      assertFalse(unit.text().isBlank());
    }
    assertEquals(sentence, String.join(" ", units.stream().map(SourceUnit::text).toList()));
  }

  @Test
  void splitsTextWithoutAnySeparatorWithoutBreakingSurrogatePairs() {
    String source = "😀".repeat(120);
    var units = SourceUnitSegmenter.segment(source);
    assertTrue(units.size() > 1);
    for (SourceUnit unit : units) {
      assertTrue(unit.text().length() <= SourceUnitSegmenter.MAX_UNIT_CHARS);
      assertEquals(0, unit.text().length() % 2, "a surrogate pair was cut");
    }
    assertEquals(source, units.stream().map(SourceUnit::text).reduce("", String::concat));
  }

  @Test
  void unitsAreOrderedAndNeverOverlap() {
    String source = "A. B. C là ba. Dòng.\nCuối cùng!";
    int previousEnd = 0;
    for (SourceUnit unit : SourceUnitSegmenter.segment(source)) {
      assertTrue(unit.start() >= previousEnd);
      assertTrue(unit.end() > unit.start());
      previousEnd = unit.end();
    }
  }

  @Test
  void rejectsBlankSource() {
    assertThrows(IllegalArgumentException.class, () -> SourceUnitSegmenter.segment(null));
    assertThrows(IllegalArgumentException.class, () -> SourceUnitSegmenter.segment("  \n "));
  }
}
