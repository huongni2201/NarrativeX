package com.narrativex.backend.feature.auth.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "auth_users")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthUserJpaEntity {
  @Id
  @Column(length = 128, nullable = false)
  private String id;

  @Column(length = 320, nullable = false, unique = true)
  private String email;

  @Column(name = "display_name", length = 160, nullable = false)
  private String displayName;

  @Column(name = "avatar_url", columnDefinition = "TEXT")
  private String avatarUrl;

  @Column(name = "password_hash", length = 255)
  private String passwordHash;

  @Column(name = "google_subject", length = 255, unique = true)
  private String googleSubject;

  @Column(nullable = false)
  private boolean enabled;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  public void linkGoogle(String subject, String displayName, String avatarUrl) {
    this.googleSubject = subject;
    if (displayName != null && !displayName.isBlank()) {
      this.displayName = displayName;
    }
    if (avatarUrl != null && !avatarUrl.isBlank()) {
      this.avatarUrl = avatarUrl;
    }
    this.updatedAt = Instant.now();
  }
}
