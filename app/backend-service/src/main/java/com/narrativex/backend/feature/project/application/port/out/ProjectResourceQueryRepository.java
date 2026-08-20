package com.narrativex.backend.feature.project.application.port.out;

import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.project.application.query.ProjectResourceView;

public interface ProjectResourceQueryRepository {
  CursorPage<ProjectResourceView.Location> listLocations(Long projectId, String cursor, int limit);

  CursorPage<ProjectResourceView.Asset> listAssets(Long projectId, String cursor, int limit);
}
