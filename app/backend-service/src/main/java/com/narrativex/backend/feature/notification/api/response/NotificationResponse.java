package com.narrativex.backend.feature.notification.api.response;

import com.narrativex.backend.feature.notification.application.query.NotificationView;
import com.narrativex.backend.feature.notification.application.usecase.NotificationUseCase.NotificationFeed;
import java.time.Instant;
import java.util.List;

public record NotificationResponse(
    Long id,
    Long projectId,
    String type,
    String titleKey,
    String messageKey,
    Instant readAt,
    Instant createdAt) {
  public static NotificationResponse from(NotificationView view) {
    return new NotificationResponse(
        view.id(),
        view.projectId(),
        view.type(),
        view.titleKey(),
        view.messageKey(),
        view.readAt(),
        view.createdAt());
  }

  public record Feed(int unreadCount, List<NotificationResponse> items) {
    public static Feed from(NotificationFeed feed) {
      return new Feed(
          feed.unreadCount(), feed.items().stream().map(NotificationResponse::from).toList());
    }
  }

  public record MarkAllRead(int updatedCount) {}
}
