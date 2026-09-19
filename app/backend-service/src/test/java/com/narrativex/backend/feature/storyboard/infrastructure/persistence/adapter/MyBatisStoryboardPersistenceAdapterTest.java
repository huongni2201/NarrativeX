package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.narrativex.backend.feature.storyboard.domain.entity.StoryBeat;
import com.narrativex.backend.feature.storyboard.domain.enums.StoryBeatReviewStatus;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.StoryBeatRow;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MyBatisStoryboardPersistenceAdapterTest {

  @Test
  void toDomainMapsValidRowCorrectly() {
    StoryBeatRow row = createBaseRow();
    row.setReviewStatus("APPROVED");

    StoryBeat beat = MyBatisStoryboardPersistenceAdapter.toDomain(row);

    assertEquals(StoryBeatReviewStatus.APPROVED, beat.getReviewStatus());
    assertEquals(row.getId(), beat.getId());
  }

  @Test
  void toDomainFailsFastOnUnknownReviewStatus() {
    StoryBeatRow row = createBaseRow();
    row.setReviewStatus("UNKNOWN_STATUS_VALUE");

    IllegalStateException exception =
        assertThrows(
            IllegalStateException.class, () -> MyBatisStoryboardPersistenceAdapter.toDomain(row));

    assertEquals(
        "StoryBeat row " + row.getId() + " has invalid reviewStatus in DB: UNKNOWN_STATUS_VALUE",
        exception.getMessage());
  }

  @Test
  void toDomainFailsFastOnNullReviewStatus() {
    StoryBeatRow row = createBaseRow();
    row.setReviewStatus(null);

    IllegalStateException exception =
        assertThrows(
            IllegalStateException.class, () -> MyBatisStoryboardPersistenceAdapter.toDomain(row));

    assertEquals(
        "StoryBeat row " + row.getId() + " has null reviewStatus in DB", exception.getMessage());
  }

  private StoryBeatRow createBaseRow() {
    StoryBeatRow row = new StoryBeatRow();
    row.setId(UUID.randomUUID());
    row.setRowVersion(1L);
    row.setSceneId(UUID.randomUUID());
    row.setOrderIndex(0);
    row.setPurpose("PLOT");
    row.setSummary("Summary");
    row.setImportance("NORMAL");
    row.setStoryFunctionsJson("[]");
    row.setContinuityStateJson("{}");
    return row;
  }
}
