package com.narrativex.backend.feature.auth.infrastructure.persistence.mybatis;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthUserRow {
  private String id;
  private String email;
  private String displayName;
  private String avatarUrl;
  private String googleSubject;
  private boolean enabled;
  private Instant createdAt;
  private Instant updatedAt;

  public void linkGoogle(String subject, String displayName, String avatarUrl) {
    googleSubject = subject;
    if (displayName != null && !displayName.isBlank()) {
      this.displayName = displayName;
    }
    if (avatarUrl != null && !avatarUrl.isBlank()) {
      this.avatarUrl = avatarUrl;
    }
    updatedAt = Instant.now();
  }
}
