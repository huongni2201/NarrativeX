package com.narrativex.backend.feature.notification.application.query;

import java.time.Instant;

public record NotificationView(
    Long id,
    Long projectId,
    String type,
    String titleKey,
    String messageKey,
    Instant readAt,
    Instant createdAt) {}
