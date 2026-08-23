package com.narrativex.backend.feature.project.application.port.out;

import com.narrativex.backend.feature.project.application.query.ProjectOverviewView;
import java.util.UUID;

public interface ProjectOverviewQueryRepository {
  ProjectOverviewView get(UUID projectId);
}
