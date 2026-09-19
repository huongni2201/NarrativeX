package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.ComputeEventReceiptRepository;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ComputeEventReceiptMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ComputeEventReceiptRow;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class MyBatisComputeEventReceiptRepository implements ComputeEventReceiptRepository {
  private final ComputeEventReceiptMapper mapper;

  @Override
  public boolean existsByEventId(String eventId) {
    return mapper.existsByEventId(eventId);
  }

  @Override
  public void recordReceipt(
      String eventId,
      UUID taskId,
      UUID attemptId,
      Long sequence,
      String eventType,
      Instant receivedAt,
      String payloadHash) {
    mapper.insert(
        new ComputeEventReceiptRow(
            eventId, taskId, attemptId, sequence, eventType, receivedAt, payloadHash));
  }
}
