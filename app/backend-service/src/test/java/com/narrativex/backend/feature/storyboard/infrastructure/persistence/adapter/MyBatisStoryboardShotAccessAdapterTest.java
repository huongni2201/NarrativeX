package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardShotAccess.ShotSequenceView;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardShotAccess.ShotView;
import com.narrativex.backend.feature.storyboard.domain.enums.RetentionRole;
import com.narrativex.backend.feature.storyboard.domain.enums.ShotStatus;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ShotMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ShotRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ShotSequenceRow;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class MyBatisStoryboardShotAccessAdapterTest {

  private ShotMapper shotMapper;
  private MyBatisStoryboardShotAccessAdapter adapter;

  @BeforeEach
  void setUp() {
    shotMapper = mock(ShotMapper.class);
    adapter = new MyBatisStoryboardShotAccessAdapter(shotMapper);
  }

  @Test
  void requireCurrentShots_mapsRowsToViews() {
    UUID projectId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    ShotRow row = createSampleRow();

    when(shotMapper.findCurrentShotsByChapter(projectId, chapterId)).thenReturn(List.of(row));

    List<ShotView> views = adapter.requireCurrentShots(projectId, chapterId);
    assertThat(views).hasSize(1);
    ShotView view = views.getFirst();
    assertThat(view.id()).isEqualTo(row.getId());
    assertThat(view.generationStrategy()).isEqualTo(GenerationStrategy.IMAGE_TO_VIDEO);
    assertThat(view.retentionRole()).isEqualTo(RetentionRole.HOOK);
    assertThat(view.status()).isEqualTo(ShotStatus.PLANNED);
    assertThat(view.targetDurationMs()).isEqualTo(3500L);
  }

  @Test
  void findShotById_returnsEmptyWhenNotFound() {
    UUID projectId = UUID.randomUUID();
    UUID shotId = UUID.randomUUID();
    when(shotMapper.findShotByIdAndProject(projectId, shotId)).thenReturn(null);

    Optional<ShotView> result = adapter.findShotById(projectId, shotId);
    assertThat(result).isEmpty();
  }

  @Test
  void findSequenceByBeatId_resolvesSequenceWithShots() {
    UUID projectId = UUID.randomUUID();
    UUID visualBeatId = UUID.randomUUID();
    UUID sequenceId = UUID.randomUUID();

    ShotSequenceRow seqRow = new ShotSequenceRow();
    seqRow.setId(sequenceId);
    seqRow.setRowVersion(1L);
    seqRow.setVisualBeatId(visualBeatId);
    seqRow.setOrderIndex(0);

    ShotRow shotRow = createSampleRow();
    shotRow.setSequenceId(sequenceId);

    when(shotMapper.findSequenceByBeatIdAndProject(projectId, visualBeatId)).thenReturn(seqRow);
    when(shotMapper.findBySequenceId(sequenceId)).thenReturn(List.of(shotRow));

    Optional<ShotSequenceView> result = adapter.findSequenceByBeatId(projectId, visualBeatId);
    assertThat(result).isPresent();
    ShotSequenceView seqView = result.get();
    assertThat(seqView.id()).isEqualTo(sequenceId);
    assertThat(seqView.shots()).hasSize(1);
    assertThat(seqView.shots().getFirst().id()).isEqualTo(shotRow.getId());
  }

  @Test
  void updateShotStatus_delegatesToMapper() {
    UUID shotId = UUID.randomUUID();
    adapter.updateShotStatus(shotId, ShotStatus.GENERATING);
    verify(shotMapper).updateStatus(shotId, "GENERATING");
  }

  private ShotRow createSampleRow() {
    ShotRow row = new ShotRow();
    row.setId(UUID.randomUUID());
    row.setRowVersion(1L);
    row.setSequenceId(UUID.randomUUID());
    row.setOrderIndex(0);
    row.setNarrativePurpose("Opening hook");
    row.setRetentionRole("HOOK");
    row.setSubjectsJson("[{\"aiName\":\"hero\"}]");
    row.setLocationRef("courtyard");
    row.setStartStateJson("{}");
    row.setActionJson("{\"action\":\"Draws sword\"}");
    row.setEndStateJson("{}");
    row.setCompositionJson("{}");
    row.setCameraJson("{}");
    row.setSubjectMotionJson("{}");
    row.setCameraMotionJson("{}");
    row.setEnvironmentMotionJson("{}");
    row.setTargetDurationMs(3500L);
    row.setGenerationStrategy("IMAGE_TO_VIDEO");
    row.setQualityProfile("720p_24fps_standard");
    row.setStatus("PLANNED");
    return row;
  }
}
