package com.narrativex.backend.feature.common.application.port.out;

public interface UserPlanAssignmentProvisioner {
  void ensureDefaultAssignment(String userId);
}
