package com.narrativex.backend.feature.project.application.port.out;

import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.project.application.query.ProjectResourceView;
import java.util.UUID;

public interface ProjectResourceQueryRepository {
  CursorPage<ProjectResourceView.Location> listLocations(UUID projectId, String cursor, int limit);

  CursorPage<ProjectResourceView.Asset> listAssets(UUID projectId, String cursor, int limit);
}
