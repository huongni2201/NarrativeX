package com.narrativex.backend.feature.auth.application.usecase;

import com.narrativex.backend.feature.auth.application.port.out.GuestWorkspaceOwnershipPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TransferGuestWorkspaceUseCase {
  private final GuestWorkspaceOwnershipPort guestWorkspaceOwnershipPort;

  @Transactional
  public void execute(String guestUserId, String authenticatedUserId) {
    if (guestUserId == null
        || guestUserId.isBlank()
        || authenticatedUserId == null
        || authenticatedUserId.isBlank()
        || guestUserId.equals(authenticatedUserId)) {
      return;
    }
    guestWorkspaceOwnershipPort.transfer(guestUserId, authenticatedUserId);
  }
}
