package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.ProjectRenderInputSnapshotRepository;
import com.narrativex.backend.feature.generation.application.query.ProductionTimelineView;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ProjectRenderInputSnapshotMapper;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class MyBatisProjectRenderInputSnapshotAdapter
    implements ProjectRenderInputSnapshotRepository {
  private final ProjectRenderInputSnapshotMapper mapper;

  @Override
  public void create(
      UUID generationJobId,
      ProductionTimelineView timeline,
      String resolution,
      String format,
      UUID assignedLocalDeviceId,
      boolean subtitlesEnabled) {
    if (!timeline.readyForRender()) {
      throw new IllegalArgumentException(
          "Project render snapshot requires a render-ready timeline");
    }
    if (assignedLocalDeviceId == null) {
      throw new IllegalArgumentException("Project render requires an assigned local device");
    }
    if (mapper.insertHeader(
            generationJobId,
            timeline,
            resolution,
            format,
            assignedLocalDeviceId,
            timeline.chapters().size(),
            timeline.beats().size())
        != 1) {
      throw new IllegalStateException("Project render snapshot header was not inserted");
    }
    if (mapper.updateSubtitleMode(generationJobId, subtitlesEnabled ? "burn_in" : "none") != 1) {
      throw new IllegalStateException("Project render subtitle mode was not persisted");
    }
    for (ProductionTimelineView.Chapter chapter : timeline.chapters()) {
      if (!chapter.readyForRender()) {
        throw new IllegalArgumentException("Project render snapshot contains an unready chapter");
      }
      if (mapper.insertChapter(generationJobId, chapter) != 1) {
        throw new IllegalStateException("Project render chapter snapshot was not inserted");
      }
    }
    for (ProductionTimelineView.Beat beat : timeline.beats()) {
      if (!beat.assetReady()) {
        throw new IllegalArgumentException(
            "Project render snapshot contains an unready beat asset");
      }
      if (mapper.insertBeat(generationJobId, beat) != 1) {
        throw new IllegalStateException("Project render beat snapshot was not inserted");
      }
    }
  }
}
