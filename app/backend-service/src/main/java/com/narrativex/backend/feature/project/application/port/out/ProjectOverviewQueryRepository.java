package com.narrativex.backend.feature.project.application.port.out;

import com.narrativex.backend.feature.project.application.query.ProjectOverviewView;

public interface ProjectOverviewQueryRepository {
  ProjectOverviewView get(Long projectId);
}
