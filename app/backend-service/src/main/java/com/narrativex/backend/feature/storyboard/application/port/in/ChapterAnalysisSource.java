package com.narrativex.backend.feature.storyboard.application.port.in;

import java.util.UUID;

/** Immutable saved Chapter source snapshot exposed to cross-feature analysis orchestration. */
public record ChapterAnalysisSource(
    UUID chapterId,
    UUID storyVersionId,
    long rowVersion,
    String sourceHash,
    String sourceText) {}
