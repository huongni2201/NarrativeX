package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.command.RenderBeatOverride;
import com.narrativex.backend.feature.generation.application.port.out.RenderInputSnapshotRepository;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.RenderInputSnapshotMapper;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisRenderInputSnapshotPersistenceAdapter implements RenderInputSnapshotRepository {
  private final RenderInputSnapshotMapper mapper;

  @Override
  public SnapshotResult create(
      UUID generationJobId,
      UUID projectId,
      UUID chapterId,
      long chapterRowVersion,
      String sourceHash,
      UUID mediaPlanId,
      int mediaPlanRevision,
      List<RenderBeatOverride> beatOverrides) {
    int header =
        mapper.insertHeader(
            generationJobId,
            projectId,
            chapterId,
            chapterRowVersion,
            sourceHash,
            mediaPlanId,
            mediaPlanRevision);
    if (header != 1) {
      throw new IllegalStateException("Could not create immutable render input snapshot header");
    }
    int plannedBeatCount = mapper.countPlanBeats(mediaPlanId);
    int snapshottedBeatCount = mapper.insertBeats(generationJobId, mediaPlanId);
    for (RenderBeatOverride override : beatOverrides) {
      int updated =
          mapper.applyBeatOverride(
              generationJobId,
              override.visualBeatId(),
              override.durationMs(),
              override.cameraMovement());
      if (updated != 1) {
        throw new IllegalArgumentException(
            "Render beat override does not match a READY beat in the pinned media plan: "
                + override.visualBeatId());
      }
    }
    return new SnapshotResult(
        mapper.hasNarration(generationJobId), plannedBeatCount, snapshottedBeatCount);
  }
}
