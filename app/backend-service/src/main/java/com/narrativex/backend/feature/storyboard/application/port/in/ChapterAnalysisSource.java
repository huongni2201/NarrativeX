package com.narrativex.backend.feature.storyboard.application.port.in;

/** Immutable Chapter source snapshot exposed to cross-feature analysis orchestration. */
public record ChapterAnalysisSource(
    Long chapterId, Long storyVersionId, long rowVersion, String sourceHash, String sourceText) {}
