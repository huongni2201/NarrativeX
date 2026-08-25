package com.narrativex.backend.feature.auth.infrastructure.persistence.mybatis;

import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class DesktopGuestInstallationRow {
  private UUID deviceId;
  private String guestUserId;
  private String secretHash;
}
