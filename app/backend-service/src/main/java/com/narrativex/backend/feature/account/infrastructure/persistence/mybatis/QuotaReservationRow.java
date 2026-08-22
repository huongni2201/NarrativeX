package com.narrativex.backend.feature.account.infrastructure.persistence.mybatis;

import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class QuotaReservationRow {
  private final String userId;
  private final String periodKey;
  private final BigDecimal estimatedCost;
}
