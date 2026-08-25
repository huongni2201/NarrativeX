package com.narrativex.backend.feature.assets.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.assets.application.port.out.MediaValidationJobRepository;
import com.narrativex.backend.feature.assets.application.port.out.MediaValidationJobRepository.ValidationRequest;
import com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis.MediaValidationJobMapper;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisMediaValidationJobRepository implements MediaValidationJobRepository {
  private final MediaValidationJobMapper mapper;

  @Override
  public void enqueue(ValidationRequest request) {
    mapper.insertJob(request, UuidV7.random());
    mapper.insertOutbox(request);
  }
}
