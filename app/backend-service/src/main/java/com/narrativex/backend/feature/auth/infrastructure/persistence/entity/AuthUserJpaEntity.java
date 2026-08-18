package com.narrativex.backend.feature.auth.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "auth_users")
public class AuthUserJpaEntity {
  @Id
  @Column(length = 128, nullable = false)
  private String id;

  @Column(length = 320, nullable = false, unique = true)
  private String email;

  @Column(name = "display_name", length = 160, nullable = false)
  private String displayName;

  @Column(name = "avatar_url")
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

  protected AuthUserJpaEntity() {}

  public AuthUserJpaEntity(
      String id, String email, String displayName, String avatarUrl, String passwordHash,
      String googleSubject, boolean enabled) {
    Instant now = Instant.now();
    this.id = id;
    this.email = email;
    this.displayName = displayName;
    this.avatarUrl = avatarUrl;
    this.passwordHash = passwordHash;
    this.googleSubject = googleSubject;
    this.enabled = enabled;
    this.createdAt = now;
    this.updatedAt = now;
  }

  public void linkGoogle(String subject, String displayName, String avatarUrl) {
    this.googleSubject = subject;
    if (displayName != null && !displayName.isBlank()) this.displayName = displayName;
    if (avatarUrl != null && !avatarUrl.isBlank()) this.avatarUrl = avatarUrl;
    this.updatedAt = Instant.now();
  }

  public String getId() { return id; }
  public String getEmail() { return email; }
  public String getDisplayName() { return displayName; }
  public String getAvatarUrl() { return avatarUrl; }
  public String getPasswordHash() { return passwordHash; }
  public String getGoogleSubject() { return googleSubject; }
  public boolean isEnabled() { return enabled; }
}
