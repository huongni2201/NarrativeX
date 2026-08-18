package com.narrativex.backend.feature.storyboard.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import com.narrativex.backend.feature.storyboard.application.service.ChapterSourceHasher;
import org.junit.jupiter.api.Test;

class ChapterSourceHasherTest {
  private final ChapterSourceHasher hasher = new ChapterSourceHasher();

  @Test
  void normalizesLineEndingsAndProducesDeterministicSha256() {
    var windows = hasher.normalizeAndHash("Chapter\r\nLine 2\rLine 3");
    var unix = hasher.normalizeAndHash("Chapter\nLine 2\nLine 3");

    assertEquals("Chapter\nLine 2\nLine 3", windows.text());
    assertEquals(unix.text(), windows.text());
    assertEquals(unix.hash(), windows.hash());
    assertEquals(64, windows.hash().length());
  }

  @Test
  void changedSourceChangesFingerprint() {
    var first = hasher.normalizeAndHash("one");
    var second = hasher.normalizeAndHash("two");

    assertNotEquals(first.hash(), second.hash());
  }
}
