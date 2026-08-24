package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.domain.entity.MediaGenerationItem;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.MediaGenerationItemMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.MediaGenerationItemRow;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class MyBatisMediaGenerationItemPersistenceAdapterTest {
  @Mock private MediaGenerationItemMapper mapper;

  @Test
  void returnsInsertedItemWhenPostInsertReadbackIsUnavailable() {
    MediaGenerationItem item = item();
    when(mapper.findById(item.getId())).thenReturn(null);
    when(mapper.insert(any(MediaGenerationItemRow.class))).thenReturn(item.getId());

    MyBatisMediaGenerationItemPersistenceAdapter adapter =
        new MyBatisMediaGenerationItemPersistenceAdapter(mapper);

    assertThat(adapter.save(item)).isSameAs(item);
  }

  private static MediaGenerationItem item() {
    UUID jobId = UuidV7.random();
    return MediaGenerationItem.create(
        jobId, UuidV7.random(), UuidV7.random(), "beat-1", 1, "a".repeat(64));
  }
}
