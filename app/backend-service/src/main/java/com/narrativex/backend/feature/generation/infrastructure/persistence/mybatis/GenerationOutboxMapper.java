package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.List;
import org.apache.ibatis.annotations.Param;

public interface GenerationOutboxMapper extends NarrativeXMyBatisMapper {
  int enqueue(GenerationOutboxRow row);

  List<OutboxDispatchRow> reserveBatch(@Param("reservationMillis") long reservationMillis);

  /**
   * Reserves at most {@code analysisLimit} rows whose job type is in {@code analysisJobTypes} and
   * at most {@code mediaLimit} of every other row. A limit of zero reserves nothing for that lane,
   * so a saturated lane leaves its rows untouched.
   */
  List<OutboxDispatchRow> reserveLaneBatch(
      @Param("reservationMillis") long reservationMillis,
      @Param("analysisLimit") int analysisLimit,
      @Param("mediaLimit") int mediaLimit,
      @Param("analysisJobTypes") List<String> analysisJobTypes);

  /** Pushes {@code available_at} forward for a still-pending row that a lane is working on. */
  int extendReservation(@Param("id") long id, @Param("leaseMillis") long leaseMillis);

  int markPublished(@Param("id") long id);
}
