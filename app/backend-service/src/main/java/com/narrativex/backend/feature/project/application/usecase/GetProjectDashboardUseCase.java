package com.narrativex.backend.feature.project.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import com.narrativex.backend.feature.project.api.response.ProjectDashboardResponse;
import com.narrativex.backend.feature.project.infrastructure.persistence.mybatis.ProjectDashboardMapper;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GetProjectDashboardUseCase {
  private final ProjectDashboardMapper mapper;
  private final CurrentUserId currentUserId;

  @Transactional(readOnly = true)
  public ProjectDashboardResponse execute(
      String status, String query, String sort, String cursor, int limit) {
    if (limit < 1 || limit > 100) {
      throw new DomainValidationException("limit must be between 1 and 100");
    }

    String normalizedStatus = normalizeStatus(status);
    String normalizedSort = normalizeSort(sort);
    String normalizedQuery = query == null ? null : query.trim();
    int offset = decodeOffset(cursor);
    String userId = currentUserId.get();

    var rows =
        mapper.findDashboardPage(
            userId, normalizedStatus, normalizedQuery, normalizedSort, offset, limit + 1);
    boolean hasNext = rows.size() > limit;
    var visibleRows = hasNext ? rows.subList(0, limit) : rows;
    String nextCursor = hasNext ? encodeOffset(offset + limit) : null;
    var counts = mapper.findDashboardCounts(userId, normalizedQuery);

    return new ProjectDashboardResponse(
        visibleRows.stream().map(ProjectDashboardResponse::item).toList(),
        nextCursor,
        limit,
        hasNext,
        ProjectDashboardResponse.counts(counts));
  }

  private static String normalizeStatus(String value) {
    if (value == null || value.isBlank()) return null;
    String normalized = value.trim().toUpperCase();
    if (!normalized.equals("ACTIVE") && !normalized.equals("DRAFT")) {
      throw new DomainValidationException("status must be ACTIVE or DRAFT");
    }
    return normalized;
  }

  private static String normalizeSort(String value) {
    if (value == null || value.isBlank()) return "NEWEST";
    String normalized = value.trim().toUpperCase();
    if (!normalized.equals("NEWEST")
        && !normalized.equals("OLDEST")
        && !normalized.equals("NAME")) {
      throw new DomainValidationException("sort must be NEWEST, OLDEST, or NAME");
    }
    return normalized;
  }

  private static int decodeOffset(String cursor) {
    if (cursor == null || cursor.isBlank()) return 0;
    try {
      String decoded =
          new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
      int offset = Integer.parseInt(decoded);
      if (offset < 0) throw new NumberFormatException("negative offset");
      return offset;
    } catch (IllegalArgumentException exception) {
      throw new DomainValidationException("invalid project dashboard cursor");
    }
  }

  private static String encodeOffset(int offset) {
    return Base64.getUrlEncoder()
        .withoutPadding()
        .encodeToString(Integer.toString(offset).getBytes(StandardCharsets.UTF_8));
  }
}
