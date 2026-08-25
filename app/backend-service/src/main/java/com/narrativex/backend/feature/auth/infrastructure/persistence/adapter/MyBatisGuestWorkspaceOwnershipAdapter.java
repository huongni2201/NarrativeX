package com.narrativex.backend.feature.auth.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.auth.application.port.out.GuestWorkspaceOwnershipPort;
import com.narrativex.backend.feature.auth.infrastructure.persistence.mybatis.GuestWorkspaceMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisGuestWorkspaceOwnershipAdapter implements GuestWorkspaceOwnershipPort {
  private final GuestWorkspaceMapper mapper;

  @Override
  public void transfer(String guestUserId, String authenticatedUserId) {
    mapper.transferProjects(guestUserId, authenticatedUserId);
    mapper.transferCharacters(guestUserId, authenticatedUserId);
    mapper.transferChapterCreationIdempotency(guestUserId, authenticatedUserId);

    // Checksums are account-scoped. Drop the guest canonical rows before moving assets,
    // then rebuild missing canonical entries without replacing any existing user canonical asset.
    mapper.deleteGuestMediaChecksums(guestUserId);
    mapper.transferMediaAssets(guestUserId, authenticatedUserId);
    mapper.rebuildMediaChecksums(authenticatedUserId);
  }
}
