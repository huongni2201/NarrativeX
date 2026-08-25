package com.narrativex.backend.feature.auth.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.auth.application.port.out.DesktopGuestInstallationRepository;
import com.narrativex.backend.feature.auth.application.port.out.GuestOwnershipTransferPort;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class MybatisDesktopGuestIdentityAdapter
    implements DesktopGuestInstallationRepository, GuestOwnershipTransferPort {
  private final DesktopGuestIdentityMapper mapper;

  @Override
  public void lockDevice(UUID deviceId) {
    mapper.lockDevice(deviceId);
  }

  @Override
  public Optional<Installation> findByDeviceId(UUID deviceId) {
    DesktopGuestInstallationRow row = mapper.findByDeviceId(deviceId);
    return row == null
        ? Optional.empty()
        : Optional.of(new Installation(row.getDeviceId(), row.getGuestUserId(), row.getSecretHash()));
  }

  @Override
  public boolean create(UUID deviceId, String guestUserId, String secretHash, Instant now) {
    String internalEmail = "guest+" + guestUserId.substring("guest-".length()) + "@desktop.invalid";
    if (mapper.insertGuestUser(guestUserId, internalEmail, now) != 1) return false;
    return mapper.insertInstallation(deviceId, guestUserId, secretHash, now) == 1;
  }

  @Override
  public void touch(UUID deviceId, Instant now) {
    mapper.touch(deviceId, now);
  }

  @Override
  public void transfer(String sourceUserId, String targetUserId) {
    mapper.deleteDuplicateChecksums(sourceUserId, targetUserId);
    mapper.transferProjects(sourceUserId, targetUserId);
    mapper.transferCharacters(sourceUserId, targetUserId);
    mapper.transferChapterIdempotency(sourceUserId, targetUserId);
    mapper.transferMediaAssets(sourceUserId, targetUserId);
    mapper.transferMediaChecksums(sourceUserId, targetUserId);
    mapper.transferMediaUploadSessions(sourceUserId, targetUserId);
  }
}
