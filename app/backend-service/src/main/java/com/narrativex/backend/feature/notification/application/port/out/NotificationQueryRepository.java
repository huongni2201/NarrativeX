package com.narrativex.backend.feature.notification.application.port.out;

import com.narrativex.backend.feature.notification.application.query.NotificationView;
import java.util.List;
import java.util.Optional;

public interface NotificationQueryRepository {
  List<NotificationView> list(boolean unreadOnly, int limit);

  int unreadCount();

  Optional<NotificationView> markRead(Long notificationId);

  int markAllRead();
}
