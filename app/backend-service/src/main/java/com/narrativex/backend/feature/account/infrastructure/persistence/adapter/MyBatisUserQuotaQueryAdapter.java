package com.narrativex.backend.feature.account.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.account.application.port.in.PlanFeatures;
import com.narrativex.backend.feature.account.application.port.in.UserQuotaAccess;
import com.narrativex.backend.feature.account.application.port.out.UserQuotaQueryRepository;
import com.narrativex.backend.feature.account.application.query.UserQuotaView;
import com.narrativex.backend.feature.account.infrastructure.persistence.mybatis.QuotaCurrentRow;
import com.narrativex.backend.feature.account.infrastructure.persistence.mybatis.QuotaMapper;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataRetrievalFailureException;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

@Component
@RequiredArgsConstructor
public class MyBatisUserQuotaQueryAdapter implements UserQuotaQueryRepository, UserQuotaAccess {
  private final QuotaMapper mapper;
  private final JsonMapper jsonMapper;

  @Override
  public Optional<UserQuotaView> findCurrent(String userId) {
    String periodKey = mapper.currentPeriodKey();
    QuotaCurrentRow row = mapper.findCurrent(userId, periodKey);
    if (row == null) {
      return Optional.empty();
    }
    return Optional.of(
        new UserQuotaView(
            row.getPlanKey(),
            row.getStatus(),
            row.getPeriodStart(),
            row.getPeriodEnd(),
            row.isWatermarkRequired(),
            row.getMaxVideoQuality(),
            row.getMaxLongformExportsMonth(),
            row.getMaxShortExportsMonth(),
            row.getMaxConcurrentExpensiveJobs(),
            row.getFeatureFlagsJson(),
            row.getLongformExports(),
            row.getShortExports(),
            row.getActiveReservedJobs()));
  }

  @Override
  public Optional<UserQuotaAccess.QuotaSnapshot> findCurrentQuota(String userId) {
    return findCurrent(userId)
        .map(
            quota ->
                new UserQuotaAccess.QuotaSnapshot(
                    parseFeatures(quota.featureFlagsJson()),
                    quota.maxConcurrentExpensiveJobs(),
                    quota.expensiveJobsActive(),
                    quota.watermarkRequired(),
                    quota.maxVideoQuality(),
                    quota.maxLongformExportsMonth(),
                    quota.maxShortExportsMonth(),
                    quota.longformExportsUsed(),
                    quota.shortExportsUsed()));
  }

  private PlanFeatures parseFeatures(String json) {
    if (json == null || json.isBlank()) {
      return PlanFeatures.none();
    }
    try {
      return jsonMapper.readValue(json, PlanFeatures.class);
    } catch (JacksonException exception) {
      throw new DataRetrievalFailureException(
          "Invalid feature_flags_json for active plan entitlement", exception);
    }
  }
}
