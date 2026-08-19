package com.narrativex.backend.feature.project.application.port.out;

import com.narrativex.backend.feature.project.application.query.ProjectResourceView;
import java.util.List;

public interface ProjectResourceQueryRepository {
  List<ProjectResourceView.Location> listLocations(Long projectId);

  List<ProjectResourceView.Asset> listAssets(Long projectId);
}
