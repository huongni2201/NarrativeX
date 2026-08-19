package com.narrativex.backend.feature.account.application.port.out;

import com.narrativex.backend.feature.account.application.query.UserQuotaView;
import java.util.Optional;

public interface UserQuotaQueryRepository {
  Optional<UserQuotaView> findCurrent(String userId);
}
