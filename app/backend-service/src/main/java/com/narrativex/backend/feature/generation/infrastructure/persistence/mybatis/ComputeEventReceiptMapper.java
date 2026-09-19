package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface ComputeEventReceiptMapper extends NarrativeXMyBatisMapper {
  @Insert(
      """
      INSERT INTO compute_event_receipts
          (event_id, task_id, attempt_id, sequence, event_type, received_at, payload_hash)
      VALUES
          (#{eventId}, #{taskId}, #{attemptId}, #{sequence}, #{eventType}, #{receivedAt}, #{payloadHash})
      ON CONFLICT (event_id) DO NOTHING
      """)
  int insert(ComputeEventReceiptRow row);

  @Select("SELECT COUNT(*) > 0 FROM compute_event_receipts WHERE event_id = #{eventId}")
  boolean existsByEventId(@Param("eventId") String eventId);

  @Select(
      """
      SELECT event_id AS eventId, task_id AS taskId, attempt_id AS attemptId,
             sequence, event_type AS eventType, received_at AS receivedAt,
             payload_hash AS payloadHash
        FROM compute_event_receipts
       WHERE event_id = #{eventId}
      """)
  ComputeEventReceiptRow findByEventId(@Param("eventId") String eventId);
}
