package com.narrativex.backend.feature.storyboard.api.response;

import java.util.UUID;

public record ChapterContentImportResponse(UUID chapterId, long rowVersion, String sourceHash) {}
