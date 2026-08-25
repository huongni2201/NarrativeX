package com.narrativex.backend.feature.auth.infrastructure.persistence.mybatis;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class DesktopGuestInstallationRow {
  private String deviceId;
  private String guestUserId;
  private String secretHash;
}
