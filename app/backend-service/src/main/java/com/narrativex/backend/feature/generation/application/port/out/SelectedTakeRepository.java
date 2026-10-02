package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.domain.value.SelectedTake;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SelectedTakeRepository {
  Optional<SelectedTake> findByShotId(UUID shotId);

  List<SelectedTake> findByShotIds(List<UUID> shotIds);

  void saveSelection(UUID shotId, UUID takeId, long sourceInMs, long sourceOutMs);
}
