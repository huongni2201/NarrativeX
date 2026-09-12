package com.narrativex.backend.feature.account.infrastructure.persistence.mybatis;

import java.time.LocalDate;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class QuotaCurrentRow {
  private String planKey;
  private String status;
  private LocalDate periodStart;
  private LocalDate periodEnd;
  private boolean watermarkRequired;
  private String maxVideoQuality;
  private Integer maxLongformExportsMonth;
  private Integer maxShortExportsMonth;
  private int maxConcurrentExpensiveJobs;
  private String featureFlagsJson;
  private int longformExports;
  private int shortExports;
  private int activeReservedJobs;
}
