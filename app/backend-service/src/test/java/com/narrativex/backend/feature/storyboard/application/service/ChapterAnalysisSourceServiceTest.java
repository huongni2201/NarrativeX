package com.narrativex.backend.feature.storyboard.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSource;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardRevisionAccess;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterAnalysisSnapshotRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@ExtendWith(MockitoExtension.class)
class ChapterAnalysisSourceServiceTest {
  private static final String SOURCE_HASH =
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

  @Mock private StoryboardRevisionAccess storyboardRevisionAccess;
  @Mock private ChapterAnalysisSnapshotRepository chapterAnalysisSnapshotRepository;
  @InjectMocks private ChapterAnalysisSourceService service;

  @Test
  void locksChapterBeforeReadingAuthoritativeSnapshot() {
    var snapshot = new ChapterAnalysisSource(11L, 9L, 2L, SOURCE_HASH, "latest source");
    when(chapterAnalysisSnapshotRepository.requireById(11L)).thenReturn(snapshot);

    var result = service.requireForAnalysisLocked(11L);

    assertSame(snapshot, result);
    InOrder order = inOrder(storyboardRevisionAccess, chapterAnalysisSnapshotRepository);
    order.verify(storyboardRevisionAccess).lockChapter(11L);
    order.verify(chapterAnalysisSnapshotRepository).requireById(11L);
  }

  @Test
  void requiresAnExistingOuterTransactionSoTheAdvisoryLockCannotBeReleasedEarly()
      throws NoSuchMethodException {
    var method =
        ChapterAnalysisSourceService.class.getMethod("requireForAnalysisLocked", Long.class);
    var transactional = method.getAnnotation(Transactional.class);

    assertNotNull(transactional);
    assertEquals(Propagation.MANDATORY, transactional.propagation());
  }
}
