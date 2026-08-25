package com.narrativex.backend.feature.auth.application.port.out;

/** Transfers guest-owned workspace data into the authenticated account after sign-in. */
public interface GuestWorkspaceOwnershipPort {
  void transfer(String guestUserId, String authenticatedUserId);
}
