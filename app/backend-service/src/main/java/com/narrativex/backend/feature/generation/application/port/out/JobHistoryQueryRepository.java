package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.common.pagination.UuidCursorKey;
import com.narrativex.backend.feature.generation.application.query.JobHistoryView;
import java.util.List;
import java.util.UUID;

public interface JobHistoryQueryRepository {
  List<JobHistoryView> list(UUID projectId, UuidCursorKey cursor, int fetchLimit);
}
