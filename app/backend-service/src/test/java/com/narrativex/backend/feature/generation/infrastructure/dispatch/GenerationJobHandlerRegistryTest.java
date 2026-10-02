package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class GenerationJobHandlerRegistryTest {
  private VideoGenerationJobHandler videoJobHandler;
  private ImageGenerationJobHandler imageJobHandler;
  private NarrationGenerationJobHandler narrationJobHandler;
  private GenerationJobHandlerRegistry registry;

  @BeforeEach
  void setUp() {
    videoJobHandler = mock(VideoGenerationJobHandler.class);
    when(videoJobHandler.supportedType()).thenReturn(JobType.CHAPTER_GENERATE);

    imageJobHandler = mock(ImageGenerationJobHandler.class);
    when(imageJobHandler.supportedType()).thenReturn(JobType.CHAPTER_GENERATE);

    narrationJobHandler = mock(NarrationGenerationJobHandler.class);
    when(narrationJobHandler.supportedType()).thenReturn(JobType.NARRATION_GENERATE);

    registry =
        new GenerationJobHandlerRegistry(
            List.of(videoJobHandler, imageJobHandler, narrationJobHandler));
  }

  @Test
  void routesVideoFirstToVideoHandler() {
    Optional<GenerationJobHandler> handler =
        registry.findHandler(JobType.CHAPTER_GENERATE, ProductionMode.VIDEO_FIRST);
    assertTrue(handler.isPresent());
    assertEquals(videoJobHandler, handler.get());
  }

  @Test
  void routesLegacyOrImageMotionToDefaultImageHandler() {
    Optional<GenerationJobHandler> imageHandler =
        registry.findHandler(JobType.CHAPTER_GENERATE, ProductionMode.IMAGE_MOTION);
    assertTrue(imageHandler.isPresent());
    assertEquals(imageJobHandler, imageHandler.get());

    Optional<GenerationJobHandler> legacyHandler =
        registry.findHandler(JobType.CHAPTER_GENERATE, ProductionMode.LEGACY_IMAGE);
    assertTrue(legacyHandler.isPresent());
    assertEquals(imageJobHandler, legacyHandler.get());
  }

  @Test
  void routesNarrationJob() {
    Optional<GenerationJobHandler> handler = registry.findHandler(JobType.NARRATION_GENERATE);
    assertTrue(handler.isPresent());
    assertEquals(narrationJobHandler, handler.get());
  }

  @Test
  void routesJobInstanceCorrectly() {
    GenerationJob videoJob = mock(GenerationJob.class);
    when(videoJob.getType()).thenReturn(JobType.CHAPTER_GENERATE);
    when(videoJob.getProductionMode()).thenReturn(ProductionMode.VIDEO_FIRST);

    assertEquals(videoJobHandler, registry.findHandler(videoJob).orElseThrow());

    GenerationJob imageJob = mock(GenerationJob.class);
    when(imageJob.getType()).thenReturn(JobType.CHAPTER_GENERATE);
    when(imageJob.getProductionMode()).thenReturn(ProductionMode.IMAGE_MOTION);

    assertEquals(imageJobHandler, registry.findHandler(imageJob).orElseThrow());
  }

  @Test
  void throwsExceptionWhenHandlerNotFound() {
    assertThrows(
        IllegalArgumentException.class,
        () -> registry.handlerFor(JobType.CHAPTER_ANALYZE, ProductionMode.VIDEO_FIRST));
  }
}
