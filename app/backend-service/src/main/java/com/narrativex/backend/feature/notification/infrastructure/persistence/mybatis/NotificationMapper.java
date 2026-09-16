package com.narrativex.backend.feature.notification.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import org.apache.ibatis.annotations.Param;

public interface NotificationMapper extends NarrativeXMyBatisMapper {
  List<NotificationRow> list(@Param("unreadOnly") boolean unreadOnly, @Param("limit") int limit);

  int unreadCount();

  NotificationRow markRead(@Param("notificationId") Long notificationId);

  int markAllRead();
}
