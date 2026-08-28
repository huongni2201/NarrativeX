package com.narrativex.backend.feature.storyboard.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.assets.application.port.in.MediaAssetAccess;
import com.narrativex.backend.feature.assets.application.port.in.MediaAssetAccess.MediaAssetSummary;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardRevisionAccess;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import com.narrativex.backend.feature.storyboard.application.port.out.StoryboardRepository;
import com.narrativex.backend.feature.storyboard.domain.aggregate.Chapter;
import com.narrativex.backend.feature.storyboard.domain.aggregate.Scene;
import com.narrativex.backend.feature.storyboard.domain.entity.VisualBeat;
import com.narrativex.backend.feature.storyboard.domain.enums.CameraAngle;
import com.narrativex.backend.feature.storyboard.domain.enums.CameraMovement;
import com.narrativex.backend.feature.storyboard.domain.enums.MotionMode;
import com.narrativex.backend.feature.storyboard.domain.enums.SceneStatus;
import com.narrativex.backend.feature.storyboard.domain.enums.VisualBeatReviewStatus;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AttachVisualBeatPreviewMediaUseCaseTest {
  private static final UUID PROJECT_ID = UUID.randomUUID();
  private static final UUID STORY_VERSION_ID = UUID.randomUUID();
  private static final UUID CHAPTER_ID = UUID.randomUUID();
  private static final UUID SCENE_ID = UUID.randomUUID();
  private static final UUID BEAT_ID = UUID.randomUUID();
  private static final UUID MEDIA_ASSET_ID = UUID.randomUUID();

  private final CurrentUserId currentUserId = mock(CurrentUserId.class);
  private final StoryVersionAccess storyVersionAccess = mock(StoryVersionAccess.class);
  private final ChapterRepository chapterRepository = mock(ChapterRepository.class);
  private final StoryboardRepository storyboardRepository = mock(StoryboardRepository.class);
  private final StoryboardRevisionAccess storyboardRevisionAccess =
      mock(StoryboardRevisionAccess.class);
  private final MediaAssetAccess mediaAssetAccess = mock(MediaAssetAccess.class);
  private final AttachVisualBeatPreviewMediaUseCase useCase =
      new AttachVisualBeatPreviewMediaUseCase(
          currentUserId,
          storyVersionAccess,
          chapterRepository,
          storyboardRepository,
          storyboardRevisionAccess,
          mediaAssetAccess);

  private VisualBeat beat;

  @BeforeEach
  void setUp() {
    beat =
        VisualBeat.rehydrate(
            BEAT_ID,
            3,
            SCENE_ID,
            0,
            "Beat",
            "Intent",
            MotionMode.STILL,
            CameraMovement.NONE,
            CameraAngle.MEDIUM,
            null,
            null,
            VisualBeatReviewStatus.NEEDS_REVIEW);
    when(currentUserId.get()).thenReturn("owner");
    when(chapterRepository.findById(CHAPTER_ID))
        .thenReturn(Optional.of(Chapter.rehydrate(CHAPTER_ID, 0, STORY_VERSION_ID, 0, "Chapter")));
    when(storyboardRepository.findSceneById(SCENE_ID))
        .thenReturn(
            Optional.of(
                Scene.rehydrate(
                    SCENE_ID, 0, CHAPTER_ID, 0, "Scene", null, null, SceneStatus.DRAFT)));
    when(storyboardRepository.findVisualBeatById(BEAT_ID)).thenReturn(Optional.of(beat));
    when(storyboardRepository.saveVisualBeat(beat)).thenReturn(beat);
  }

  @Test
  void attachesAReadyImageWithoutAProductionTimelineBeat() {
    when(mediaAssetAccess.findOwnedSummary("owner", MEDIA_ASSET_ID))
        .thenReturn(
            Optional.of(
                new MediaAssetSummary(MEDIA_ASSET_ID, "IMAGE", "READY", "image/png", "image/png")));

    var response = useCase.execute(PROJECT_ID, CHAPTER_ID, SCENE_ID, BEAT_ID, 3, MEDIA_ASSET_ID);

    assertThat(response.data().previewMediaAssetId()).isEqualTo(MEDIA_ASSET_ID);
    assertThat(beat.getPreviewMediaAssetId()).isEqualTo(MEDIA_ASSET_ID);
  }

  @Test
  void rejectsMediaThatIsNotAReadyImage() {
    when(mediaAssetAccess.findOwnedSummary("owner", MEDIA_ASSET_ID))
        .thenReturn(
            Optional.of(
                new MediaAssetSummary(MEDIA_ASSET_ID, "VIDEO", "READY", "video/mp4", "video/mp4")));

    assertThatThrownBy(
            () -> useCase.execute(PROJECT_ID, CHAPTER_ID, SCENE_ID, BEAT_ID, 3, MEDIA_ASSET_ID))
        .isInstanceOf(ResourceConflictException.class)
        .hasMessageContaining("READY image");
    assertThat(beat.getPreviewMediaAssetId()).isNull();
  }
}
