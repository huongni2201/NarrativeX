package com.narrativex.backend.feature.storyboard.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class ChapterImportSplitterTest {
  private final ChapterImportSplitter splitter = new ChapterImportSplitter();

  @Test
  void splitsEnglishAndVietnameseChapterHeadings() {
    String source =
        """
        Chapter 1: Arrival
        First body.

        Chương 2: Đêm mưa
        Second body.
        """;

    var drafts = splitter.split(source, "story.txt");

    assertEquals(2, drafts.size());
    assertEquals("Chapter 1: Arrival", drafts.get(0).title());
    assertEquals("First body.", drafts.get(0).sourceText());
    assertEquals("Chương 2: Đêm mưa", drafts.get(1).title());
    assertEquals("Second body.", drafts.get(1).sourceText());
  }

  @Test
  void usesFileNameWhenDocumentHasNoChapterMarkers() {
    var drafts = splitter.split("A single chapter body", "opening.txt");

    assertEquals(1, drafts.size());
    assertEquals("opening", drafts.getFirst().title());
    assertEquals("A single chapter body", drafts.getFirst().sourceText());
  }

  @Test
  void rejectsBlankDocuments() {
    assertThrows(IllegalArgumentException.class, () -> splitter.split("  \n", "empty.txt"));
  }
}
