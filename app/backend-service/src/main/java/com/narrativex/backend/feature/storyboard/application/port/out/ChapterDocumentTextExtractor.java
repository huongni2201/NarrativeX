package com.narrativex.backend.feature.storyboard.application.port.out;

public interface ChapterDocumentTextExtractor {
  String extract(String fileName, String contentType, byte[] content);
}
