package com.narrativex.backend.feature.account.infrastructure.persistence.mybatis;

import java.math.BigDecimal;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ActivePlanRow {
  private String planKey;
  private BigDecimal monthlyCredits;
}
