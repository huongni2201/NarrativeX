package com.narrativex.backend.feature.notification.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.notification.application.port.out.NotificationQueryRepository;
import com.narrativex.backend.feature.notification.application.query.NotificationView;
import com.narrativex.backend.feature.notification.infrastructure.persistence.mybatis.NotificationMapper;
import com.narrativex.backend.feature.notification.infrastructure.persistence.mybatis.NotificationRow;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisNotificationQueryAdapter implements NotificationQueryRepository {
  private final NotificationMapper mapper;

  @Override
  public List<NotificationView> list(String userId, boolean unreadOnly, int limit) {
    return mapper.list(userId, unreadOnly, limit).stream()
        .map(MyBatisNotificationQueryAdapter::toView)
        .toList();
  }

  @Override
  public int unreadCount(String userId) {
    return mapper.unreadCount(userId);
  }

  @Override
  public Optional<NotificationView> markRead(String userId, Long notificationId) {
    NotificationRow row = mapper.markRead(userId, notificationId);
    return Optional.ofNullable(row).map(MyBatisNotificationQueryAdapter::toView);
  }

  @Override
  public int markAllRead(String userId) {
    return mapper.markAllRead(userId);
  }

  private static NotificationView toView(NotificationRow row) {
    return new NotificationView(
        row.getId(),
        row.getProjectId(),
        row.getType(),
        row.getTitleKey(),
        row.getMessageKey(),
        row.getReadAt(),
        row.getCreatedAt());
  }
}
