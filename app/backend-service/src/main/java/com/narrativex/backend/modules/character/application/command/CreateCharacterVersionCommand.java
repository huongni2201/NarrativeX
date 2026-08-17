package com.narrativex.backend.modules.character.application.command;

import java.util.List;

public record CreateCharacterVersionCommand(Long characterId, String bible, String visualPrompt,
                                            Long masterAssetId, List<Long> referenceAssetIds) {
}
