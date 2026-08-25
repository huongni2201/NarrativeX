package com.narrativex.backend.feature.auth.application.port.out;

public interface GuestOwnershipTransferPort {
  void transfer(String sourceUserId, String targetUserId);
}
