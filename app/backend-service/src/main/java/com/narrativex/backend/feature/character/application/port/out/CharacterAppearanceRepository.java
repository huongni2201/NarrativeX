package com.narrativex.backend.feature.character.application.port.out;

import com.narrativex.backend.feature.character.domain.entity.CharacterAppearance;

public interface CharacterAppearanceRepository {
    CharacterAppearance save(CharacterAppearance appearance);
}
