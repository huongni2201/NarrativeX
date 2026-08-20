package com.narrativex.backend.feature.project.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.project.application.port.out.ProjectOverviewQueryRepository;
import com.narrativex.backend.feature.project.application.query.ProjectOverviewView;
import com.narrativex.backend.feature.project.infrastructure.persistence.mybatis.ProjectOverviewChapterRow;
import com.narrativex.backend.feature.project.infrastructure.persistence.mybatis.ProjectOverviewRow;
import com.narrativex.backend.feature.project.infrastructure.persistence.mybatis.ProjectQueryMapper;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** MyBatis projection for the Project Overview screen. */
@Component
@RequiredArgsConstructor
public class MyBatisProjectOverviewQueryAdapter implements ProjectOverviewQueryRepository {
  private final ProjectQueryMapper mapper;

  @Override
  public ProjectOverviewView get(Long projectId) {
    ProjectOverviewRow project = mapper.findOverview(projectId);
    if (project == null) {
      throw new ResourceNotFoundException("Project was not found");
    }

    List<ProjectOverviewChapterRow> chapterRows =
        project.getStoryVersionId() == null
            ? List.of()
            : mapper.findOverviewChapters(project.getStoryVersionId());
    List<ProjectOverviewView.Chapter> chapters = chapterRows.stream().map(this::toChapter).toList();

    int totalChapters = chapters.size();
    int readyChapters =
        (int) chapters.stream().filter(chapter -> isReady(chapter.status())).count();
    int renderedChapters =
        (int) chapters.stream().filter(chapter -> "RENDERED".equals(chapter.status())).count();
    int totalScenes = chapters.stream().mapToInt(ProjectOverviewView.Chapter::sceneCount).sum();
    long estimatedDurationSeconds =
        chapters.stream().mapToLong(ProjectOverviewView.Chapter::durationSeconds).sum();

    return new ProjectOverviewView(
        project.getId(),
        project.getName(),
        project.getDescription(),
        project.getCoverImageUrl(),
        project.getStatus(),
        project.getCreatedAt(),
        project.getUpdatedAt(),
        new ProjectOverviewView.Metrics(
            totalChapters,
            readyChapters,
            renderedChapters,
            totalScenes,
            estimatedDurationSeconds,
            project.getApprovedVisualsCount(),
            project.getProcessingJobsCount(),
            calculateProgress(chapters)),
        new ProjectOverviewView.Counts(
            project.getCharactersCount(), project.getLocationsCount(), project.getAssetsCount()),
        chapters);
  }

  private ProjectOverviewView.Chapter toChapter(ProjectOverviewChapterRow row) {
    return new ProjectOverviewView.Chapter(
        row.getId(),
        row.getOrderIndex(),
        row.getTitle(),
        row.getStatus(),
        row.getSceneCount(),
        row.getDurationSeconds(),
        row.getUpdatedAt());
  }

  private static int calculateProgress(List<ProjectOverviewView.Chapter> chapters) {
    if (chapters.isEmpty()) {
      return 0;
    }
    int total = chapters.stream().mapToInt(chapter -> statusProgress(chapter.status())).sum();
    return Math.max(0, Math.min(100, Math.round((float) total / chapters.size())));
  }

  private static int statusProgress(String status) {
    return switch (status) {
      case "ANALYZING" -> 20;
      case "ANALYZED" -> 35;
      case "GENERATING_VISUALS" -> 50;
      case "VISUAL_REVIEW" -> 65;
      case "VISUAL_READY" -> 75;
      case "GENERATING_AUDIO" -> 80;
      case "AUDIO_READY" -> 85;
      case "RENDERING" -> 90;
      case "RENDERED" -> 100;
      case "FAILED" -> 0;
      default -> 10;
    };
  }

  private static boolean isReady(String status) {
    return !"DRAFT".equals(status) && !"ANALYZING".equals(status) && !"FAILED".equals(status);
  }
}
