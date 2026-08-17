package com.narrativex.backend.modules.character.application.usecase;

import com.narrativex.backend.modules.character.application.command.ChangeCharacterVersionStatusCommand;
import com.narrativex.backend.modules.character.application.port.out.CharacterVersionRepository;
import com.narrativex.backend.modules.character.domain.model.CharacterVersion;
import com.narrativex.backend.shared.error.ResourceNotFoundException;
import com.narrativex.backend.shared.security.CurrentUserId;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LockCharacterVersionUseCase {
    private final CharacterVersionRepository versionRepository;
    private final CurrentUserId currentUserId;

    public LockCharacterVersionUseCase(CharacterVersionRepository versionRepository, CurrentUserId currentUserId) {
        this.versionRepository = versionRepository;
        this.currentUserId = currentUserId;
    }

    @Transactional
    public CharacterVersion execute(ChangeCharacterVersionStatusCommand command) {
        String actorId = currentUserId.resolve(command.actorId());
        CharacterVersion version = versionRepository.findOwnedById(command.characterVersionId(), actorId)
            .orElseThrow(() -> new ResourceNotFoundException("Character version not found"));
        version.lock(actorId);
        return versionRepository.save(version);
    }
}
