package com.narrativex.backend.feature.notification.application.query;

import java.time.Instant;
import java.util.UUID;

public record NotificationView(
    Long id,
    UUID projectId,
    String type,
    String titleKey,
    String messageKey,
    Instant readAt,
    Instant createdAt) {}
