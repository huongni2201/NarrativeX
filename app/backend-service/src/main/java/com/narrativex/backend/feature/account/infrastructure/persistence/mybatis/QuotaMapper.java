package com.narrativex.backend.feature.account.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.math.BigDecimal;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface QuotaMapper extends NarrativeXMyBatisMapper {
  QuotaCurrentRow findCurrent(@Param("userId") String userId, @Param("periodKey") String periodKey);

  BigDecimal findMonthlyCreditsForUpdate(@Param("userId") String userId);

  ActivePlanRow findActivePlanForUpdate(@Param("userId") String userId);

  String currentPeriodKey();

  int ensureUsageWindow(@Param("userId") String userId, @Param("periodKey") String periodKey);

  int countActiveReservations(@Param("userId") String userId);

  BigDecimal findCreditsUsedForUpdate(
      @Param("userId") String userId, @Param("periodKey") String periodKey);

  BigDecimal findCreditsReserved(
      @Param("userId") String userId, @Param("periodKey") String periodKey);

  Long insertReservation(QuotaReservationRow row);

  int bindToGenerationJob(
      @Param("reservationId") long reservationId, @Param("generationJobId") UUID generationJobId);

  int countBilledOperations(@Param("generationJobId") UUID generationJobId);

  int consumeForJob(@Param("generationJobId") UUID generationJobId);

  int releaseForJob(@Param("generationJobId") UUID generationJobId);
}
