package com.narrativex.backend.feature.auth.application.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.out.AuthAccountRegistration;
import com.narrativex.backend.feature.auth.application.port.out.PasswordHashing;
import com.narrativex.backend.feature.common.application.port.out.UserPlanAssignmentProvisioner;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class RegisterAuthAccountServiceTest {
  @Mock private AuthAccountRegistration accounts;
  @Mock private PasswordHashing passwordHashing;
  @Mock private UserPlanAssignmentProvisioner userPlanAssignmentProvisioner;

  @InjectMocks private RegisterAuthAccountService service;

  @Test
  void registrationProvisionsTheDefaultPlanForTheNewAccount() {
    when(passwordHashing.encode("password")).thenReturn("hashed-password");

    String userId = service.register("  Narrative User  ", " User@Example.com ", "password");

    assertNotNull(userId);
    assertFalse(userId.isBlank());
    verify(accounts)
        .createPasswordAccount(userId, "user@example.com", "Narrative User", "hashed-password");
    verify(userPlanAssignmentProvisioner).ensureDefaultAssignment(userId);
  }
}
