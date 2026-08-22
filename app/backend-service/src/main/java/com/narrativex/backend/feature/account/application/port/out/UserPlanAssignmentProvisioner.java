package com.narrativex.backend.feature.account.application.port.out;

public interface UserPlanAssignmentProvisioner {
  void ensureDefaultAssignment(String userId);
}
