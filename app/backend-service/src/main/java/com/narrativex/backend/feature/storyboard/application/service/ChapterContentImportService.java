package com.narrativex.backend.feature.storyboard.application.service;

import com.narrativex.backend.feature.storyboard.application.port.out.ChapterContentVariantRepository;
import com.narrativex.backend.feature.storyboard.application.port.out.LanguageDetectionProvider;
import com.narrativex.backend.feature.storyboard.application.port.out.LanguageDetectionRepository;
import com.narrativex.backend.feature.storyboard.domain.value.ChapterContentVariant;
import com.narrativex.backend.feature.storyboard.domain.value.LanguageDetection;
import com.narrativex.backend.feature.storyboard.domain.value.LanguageDetectionResult;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** Saves a new original snapshot and its deterministic detection result as one application step. */
@Service
@RequiredArgsConstructor
public class ChapterContentImportService {
  private final ChapterContentVariantRepository variantRepository;
  private final LanguageDetectionRepository detectionRepository;
  private final LanguageDetectionProvider detectionProvider;

  public ImportedContent importOriginal(Long chapterId, String content, String contentHash) {
    LanguageDetectionResult result = detectionProvider.detect(content);
    String languageCode = result.detectedLanguage().equals("MULTILINGUAL")
        || result.detectedLanguage().equals("UNKNOWN") ? "und" : result.detectedLanguage();
    ChapterContentVariant variant =
        variantRepository.saveOriginal(chapterId, languageCode, content, contentHash);
    variantRepository.markTranslationsStale(chapterId, variant.id());
    LanguageDetection detection =
        new LanguageDetection(null, variant.id(), result.detectedLanguage(), result.confidence(),
            result.detector(), contentHash, Instant.now());
    LanguageDetection saved = detectionRepository.save(detection);
    return new ImportedContent(variant, saved);
  }

  public record ImportedContent(ChapterContentVariant variant, LanguageDetection detection) {}
}
