package com.narrativex.backend.feature.auth.infrastructure.desktop;

import java.time.OffsetDateTime;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class DesktopAuthHandoffRow {
  private String codeHash;
  private String userId;
  private String displayName;
  private String email;
  private String avatarUrl;
  private String codeChallenge;
  private OffsetDateTime expiresAt;
}
