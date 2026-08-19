package com.narrativex.backend.feature.notification.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.notification.application.port.out.NotificationQueryRepository;
import com.narrativex.backend.feature.notification.application.query.NotificationView;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class NotificationUseCase {
  private final CurrentUserId currentUserId;
  private final NotificationQueryRepository repository;

  @Transactional(readOnly = true)
  public NotificationFeed list(boolean unreadOnly, int limit) {
    if (limit < 1 || limit > 100)
      throw new IllegalArgumentException("limit must be between 1 and 100");
    String userId = currentUserId.get();
    return new NotificationFeed(
        repository.unreadCount(userId), repository.list(userId, unreadOnly, limit));
  }

  @Transactional
  public NotificationView markRead(Long notificationId) {
    return repository
        .markRead(currentUserId.get(), notificationId)
        .orElseThrow(() -> new ResourceNotFoundException("Notification was not found"));
  }

  @Transactional
  public int markAllRead() {
    return repository.markAllRead(currentUserId.get());
  }

  public record NotificationFeed(int unreadCount, List<NotificationView> items) {}
}
