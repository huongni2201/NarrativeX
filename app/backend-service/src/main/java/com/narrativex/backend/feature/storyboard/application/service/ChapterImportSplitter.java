package com.narrativex.backend.feature.storyboard.application.service;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

@Component
public class ChapterImportSplitter {
  private static final Pattern HEADER =
      Pattern.compile("(?im)^[\\t ]*((?:chapter|chương)\\s+[^\\r\\n]+)[\\t ]*$");

  public List<Draft> split(String extractedText, String fileName) {
    String text = normalize(extractedText);
    if (text.isBlank()) throw new IllegalArgumentException("Import document contains no text");

    Matcher matcher = HEADER.matcher(text);
    List<Header> headers = new ArrayList<>();
    while (matcher.find()) headers.add(new Header(matcher.start(), matcher.end(), matcher.group(1).trim()));

    if (headers.isEmpty()) {
      return List.of(new Draft(defaultTitle(fileName), text.trim()));
    }

    List<Draft> drafts = new ArrayList<>();
    for (int i = 0; i < headers.size(); i++) {
      Header header = headers.get(i);
      int bodyEnd = i + 1 < headers.size() ? headers.get(i + 1).start() : text.length();
      String body = text.substring(header.end(), bodyEnd).trim();
      if (!body.isBlank()) drafts.add(new Draft(limitTitle(header.title()), body));
    }
    if (drafts.isEmpty()) throw new IllegalArgumentException("No chapter content was found after chapter headings");
    return List.copyOf(drafts);
  }

  private static String normalize(String value) {
    return value == null ? "" : value.replace("\r\n", "\n").replace('\r', '\n');
  }

  private static String defaultTitle(String fileName) {
    String name = fileName == null ? "Imported chapter" : fileName.trim();
    int dot = name.lastIndexOf('.');
    if (dot > 0) name = name.substring(0, dot);
    if (name.isBlank()) name = "Imported chapter";
    return limitTitle(name);
  }

  private static String limitTitle(String value) {
    String normalized = value.trim();
    return normalized.length() <= 200 ? normalized : normalized.substring(0, 200);
  }

  private record Header(int start, int end, String title) {}

  public record Draft(String title, String sourceText) {}
}
