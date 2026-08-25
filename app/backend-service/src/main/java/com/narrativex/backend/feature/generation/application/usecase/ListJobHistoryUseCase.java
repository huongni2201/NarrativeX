package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.pagination.CursorCodec;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.generation.application.port.out.JobHistoryQueryRepository;
import com.narrativex.backend.feature.generation.application.query.JobHistoryView;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ListJobHistoryUseCase {
  private final CurrentUserId currentUserId;
  private final JobHistoryQueryRepository repository;

  @Transactional(readOnly = true)
  public CursorPage<JobHistoryView> execute(String cursor, int limit) {
    if (limit < 1 || limit > 100)
      throw new IllegalArgumentException("limit must be between 1 and 100");
    var cursorKey = CursorCodec.decodeUuid(cursor);
    List<JobHistoryView> rows = repository.list(currentUserId.get(), cursorKey, limit + 1);
    boolean hasNext = rows.size() > limit;
    List<JobHistoryView> content = hasNext ? rows.subList(0, limit) : rows;
    String nextCursor = null;
    if (hasNext && !content.isEmpty()) {
      JobHistoryView last = content.getLast();
      nextCursor = CursorCodec.encode(last.createdAt(), last.id());
    }
    return new CursorPage<>(content, nextCursor, limit, hasNext);
  }
}
