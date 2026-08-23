package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.storyboard.application.port.out.LanguageDetectionRepository;
import com.narrativex.backend.feature.storyboard.domain.value.LanguageDetection;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.LanguageDetectionMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.LanguageDetectionRow;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisLanguageDetectionRepository implements LanguageDetectionRepository {
  private final LanguageDetectionMapper mapper;

  @Override
  public LanguageDetection save(LanguageDetection detection) {
    Long id =
        mapper.insert(
            new LanguageDetectionRow(
                detection.id(),
                detection.contentVariantId(),
                detection.detectedLanguage(),
                detection.confidence(),
                detection.detector(),
                detection.contentHash(),
                detection.detectedAt()));
    LanguageDetectionRow row =
        mapper.findLatest(detection.contentVariantId(), detection.contentHash());
    return new LanguageDetection(
        id == null ? row.getId() : id,
        row.getContentVariantId(),
        row.getDetectedLanguage(),
        row.getConfidence(),
        row.getDetector(),
        row.getContentHash(),
        row.getDetectedAt());
  }

  @Override
  public Optional<LanguageDetection> findLatest(Long contentVariantId, String contentHash) {
    LanguageDetectionRow row = mapper.findLatest(contentVariantId, contentHash);
    return Optional.ofNullable(row)
        .map(
            r ->
                new LanguageDetection(
                    r.getId(),
                    r.getContentVariantId(),
                    r.getDetectedLanguage(),
                    r.getConfidence(),
                    r.getDetector(),
                    r.getContentHash(),
                    r.getDetectedAt()));
  }
}
