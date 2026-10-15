package com.narrativex.backend.feature.character.domain.service;

import com.narrativex.backend.feature.character.domain.enums.CharacterReferenceSlot;
import com.narrativex.backend.feature.character.domain.value.CharacterVersionReference;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;

public final class CharacterReferencePackPolicy {
  private CharacterReferencePackPolicy() {}

  public static List<CharacterReferenceSlot> missingSlots(
      List<CharacterVersionReference> references) {
    EnumSet<CharacterReferenceSlot> present = EnumSet.noneOf(CharacterReferenceSlot.class);
    references.stream()
        .map(CharacterVersionReference::slot)
        .filter(slot -> slot != null)
        .forEach(present::add);
    return Arrays.stream(CharacterReferenceSlot.values())
        .filter(slot -> !present.contains(slot))
        .toList();
  }

  public static List<CharacterReferenceSlot> duplicateSlots(
      List<CharacterVersionReference> references) {
    EnumSet<CharacterReferenceSlot> seen = EnumSet.noneOf(CharacterReferenceSlot.class);
    EnumSet<CharacterReferenceSlot> duplicates = EnumSet.noneOf(CharacterReferenceSlot.class);
    references.stream()
        .map(CharacterVersionReference::slot)
        .filter(slot -> slot != null)
        .forEach(
            slot -> {
              if (!seen.add(slot)) duplicates.add(slot);
            });
    return Arrays.stream(CharacterReferenceSlot.values()).filter(duplicates::contains).toList();
  }

  public static boolean hasSlotlessReferences(List<CharacterVersionReference> references) {
    return references.stream().anyMatch(reference -> reference.slot() == null);
  }
}
