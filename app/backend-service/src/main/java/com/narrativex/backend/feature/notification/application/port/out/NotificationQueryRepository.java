package com.narrativex.backend.feature.notification.application.port.out;

import com.narrativex.backend.feature.notification.application.query.NotificationView;
import java.util.List;
import java.util.Optional;

public interface NotificationQueryRepository {
  List<NotificationView> list(String userId, boolean unreadOnly, int limit);

  int unreadCount(String userId);

  Optional<NotificationView> markRead(String userId, Long notificationId);

  int markAllRead(String userId);
}
