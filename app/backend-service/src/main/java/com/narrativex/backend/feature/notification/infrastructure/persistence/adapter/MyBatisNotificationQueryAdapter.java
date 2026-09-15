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
  public List<NotificationView> list(boolean unreadOnly, int limit) {
    return mapper.list(unreadOnly, limit).stream()
        .map(MyBatisNotificationQueryAdapter::toView)
        .toList();
  }

  @Override
  public int unreadCount() {
    return mapper.unreadCount();
  }

  @Override
  public Optional<NotificationView> markRead(Long notificationId) {
    NotificationRow row = mapper.markRead(notificationId);
    return Optional.ofNullable(row).map(MyBatisNotificationQueryAdapter::toView);
  }

  @Override
  public int markAllRead() {
    return mapper.markAllRead();
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
