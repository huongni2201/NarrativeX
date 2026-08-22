package com.narrativex.backend.feature.notification.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import org.apache.ibatis.annotations.Param;

public interface NotificationMapper extends NarrativeXMyBatisMapper {
  List<NotificationRow> list(
      @Param("userId") String userId,
      @Param("unreadOnly") boolean unreadOnly,
      @Param("limit") int limit);

  int unreadCount(@Param("userId") String userId);

  NotificationRow markRead(
      @Param("userId") String userId, @Param("notificationId") Long notificationId);

  int markAllRead(@Param("userId") String userId);
}
