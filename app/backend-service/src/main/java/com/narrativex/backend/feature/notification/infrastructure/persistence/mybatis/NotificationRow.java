package com.narrativex.backend.feature.notification.infrastructure.persistence.mybatis;

import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class NotificationRow {
  private Long id;
  private Long projectId;
  private String type;
  private String titleKey;
  private String messageKey;
  private Instant readAt;
  private Instant createdAt;
}
