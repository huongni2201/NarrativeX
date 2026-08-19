package com.narrativex.backend.feature.notification.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.notification.application.port.out.NotificationQueryRepository;
import com.narrativex.backend.feature.notification.application.query.NotificationView;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class JdbcNotificationQueryAdapter implements NotificationQueryRepository {
  private final JdbcTemplate jdbcTemplate;

  @Override
  public List<NotificationView> list(String userId, boolean unreadOnly, int limit) {
    return jdbcTemplate.query(
        """
        SELECT id, project_id, type, title_key, message_key, read_at, created_at
          FROM notifications
         WHERE user_id = ?
           AND (? = FALSE OR read_at IS NULL)
         ORDER BY created_at DESC, id DESC
         LIMIT ?
        """,
        (rs, rowNum) -> map(rs),
        userId,
        unreadOnly,
        limit);
  }

  @Override
  public int unreadCount(String userId) {
    Integer count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*)::int FROM notifications WHERE user_id = ? AND read_at IS NULL",
            Integer.class,
            userId);
    return count == null ? 0 : count;
  }

  @Override
  public Optional<NotificationView> markRead(String userId, Long notificationId) {
    return jdbcTemplate
        .query(
            """
            UPDATE notifications
               SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
             WHERE id = ? AND user_id = ?
         RETURNING id, project_id, type, title_key, message_key, read_at, created_at
            """,
            (rs, rowNum) -> map(rs),
            notificationId,
            userId)
        .stream()
        .findFirst();
  }

  @Override
  public int markAllRead(String userId) {
    return jdbcTemplate.update(
        "UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL",
        userId);
  }

  private static NotificationView map(ResultSet rs) throws SQLException {
    Long projectId = rs.getObject("project_id", Long.class);
    return new NotificationView(
        rs.getLong("id"),
        projectId,
        rs.getString("type"),
        rs.getString("title_key"),
        rs.getString("message_key"),
        instant(rs, "read_at"),
        instant(rs, "created_at"));
  }

  private static Instant instant(ResultSet rs, String column) throws SQLException {
    Timestamp timestamp = rs.getTimestamp(column);
    return timestamp == null ? null : timestamp.toInstant();
  }
}
