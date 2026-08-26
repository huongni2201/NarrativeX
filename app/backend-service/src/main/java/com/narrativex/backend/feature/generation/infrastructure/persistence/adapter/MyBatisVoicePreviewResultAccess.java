package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.port.out.VoicePreviewResultAccess;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.NarrationMapper;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class MyBatisVoicePreviewResultAccess implements VoicePreviewResultAccess {
  private final NarrationMapper narrationMapper;

  @Override
  public VoicePreviewResult findCompleted(String ownerId, UUID projectId, UUID jobId) {
    var row = narrationMapper.findCompletedVoicePreview(ownerId, projectId, jobId);
    if (row == null) {
      throw new ResourceNotFoundException("Completed voice preview not found");
    }
    return new VoicePreviewResult(row.getStorageKey(), row.getContentType(), row.getDurationMs());
  }
}
