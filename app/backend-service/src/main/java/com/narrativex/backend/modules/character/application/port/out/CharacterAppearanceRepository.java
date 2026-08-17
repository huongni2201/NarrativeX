package com.narrativex.backend.modules.character.application.port.out;

import com.narrativex.backend.modules.character.domain.aggregate.CharacterAppearance;

public interface CharacterAppearanceRepository {
    CharacterAppearance save(CharacterAppearance appearance);
}
