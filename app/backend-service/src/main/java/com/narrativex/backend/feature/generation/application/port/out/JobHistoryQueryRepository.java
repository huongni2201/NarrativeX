package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.common.pagination.CursorKey;
import com.narrativex.backend.feature.generation.application.query.JobHistoryView;
import java.util.List;

public interface JobHistoryQueryRepository {
  List<JobHistoryView> list(String userId, CursorKey cursor, int fetchLimit);
}
