package com.narrativex.backend.feature.catalog.application.port.out;

/** Persistence for user-created voices stored in the installation voice catalog. */
public interface CustomVoiceRepository {
  /** Returns false when an enabled VieNeu voice already uses the name (case-insensitive). */
  boolean insert(String id, String name, String language, String gender, String metadataJson);

  /** Disables only custom voices; returns false when no enabled custom voice matches. */
  boolean disable(String id);
}
