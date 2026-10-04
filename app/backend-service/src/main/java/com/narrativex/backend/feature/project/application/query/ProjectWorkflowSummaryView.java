package com.narrativex.backend.feature.project.application.query;

/** Backend-authoritative progress through the project creation and production workflow. */
public record ProjectWorkflowSummaryView(
    boolean hasChapter,
    boolean analysisReady,
    boolean canonReady,
    boolean storyReady,
    boolean productionStarted,
    boolean productionReady,
    boolean editorReady,
    boolean renderInProgress,
    String latestStage) {}
