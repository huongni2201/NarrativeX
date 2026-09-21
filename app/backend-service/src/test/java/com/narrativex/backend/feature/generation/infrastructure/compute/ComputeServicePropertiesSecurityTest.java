package com.narrativex.backend.feature.generation.infrastructure.compute;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;

class ComputeServicePropertiesSecurityTest {

  @Test
  void throwsInProdProfileWhenUsingDefaultDevMachineToken() {
    Environment env = mock(Environment.class);
    when(env.getActiveProfiles()).thenReturn(new String[] {"prod"});

    ComputeServiceProperties props = new ComputeServiceProperties();
    props.setEnvironment(env);
    props.setMachineToken("default-dev-machine-token");

    assertThrows(IllegalStateException.class, props::validateSecurityInvariants);
  }

  @Test
  void throwsInProdProfileWhenMachineTokenIsBlank() {
    Environment env = mock(Environment.class);
    when(env.getActiveProfiles()).thenReturn(new String[] {"prod"});

    ComputeServiceProperties props = new ComputeServiceProperties();
    props.setEnvironment(env);
    props.setMachineToken("   ");

    assertThrows(IllegalStateException.class, props::validateSecurityInvariants);
  }

  @Test
  void throwsInProdProfileWhenCallbackSecretIsDefault() {
    Environment env = mock(Environment.class);
    when(env.getActiveProfiles()).thenReturn(new String[] {"prod"});

    ComputeServiceProperties props = new ComputeServiceProperties();
    props.setEnvironment(env);
    props.setMachineToken("super-secure-production-token-12345");
    props.setCallbackSecret("default-dev-machine-token");

    assertThrows(IllegalStateException.class, props::validateSecurityInvariants);
  }

  @Test
  void allowsSecureTokensInProdProfile() {
    Environment env = mock(Environment.class);
    when(env.getActiveProfiles()).thenReturn(new String[] {"prod"});

    ComputeServiceProperties props = new ComputeServiceProperties();
    props.setEnvironment(env);
    props.setMachineToken("super-secure-production-token-12345");
    props.setCallbackSecret("super-secure-callback-secret-67890");

    assertDoesNotThrow(props::validateSecurityInvariants);
  }

  @Test
  void allowsDefaultDevMachineTokenInDevProfile() {
    Environment env = mock(Environment.class);
    when(env.getActiveProfiles()).thenReturn(new String[] {"dev"});

    ComputeServiceProperties props = new ComputeServiceProperties();
    props.setEnvironment(env);
    props.setMachineToken("default-dev-machine-token");

    assertDoesNotThrow(props::validateSecurityInvariants);
  }
}
