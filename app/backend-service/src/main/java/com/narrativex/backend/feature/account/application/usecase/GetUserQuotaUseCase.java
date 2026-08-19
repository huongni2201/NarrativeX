package com.narrativex.backend.feature.account.application.usecase;

import com.narrativex.backend.feature.account.application.port.out.UserQuotaQueryRepository;
import com.narrativex.backend.feature.account.application.query.UserQuotaView;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GetUserQuotaUseCase {
  private final CurrentUserId currentUserId;
  private final UserQuotaQueryRepository repository;

  @Transactional(readOnly = true)
  public UserQuotaView execute() {
    return repository
        .findCurrent(currentUserId.get())
        .orElseThrow(() -> new ResourceNotFoundException("Active plan assignment was not found"));
  }
}
