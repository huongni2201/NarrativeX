package com.narrativex.backend.modules.character.application.usecase;

import com.narrativex.backend.modules.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.modules.character.application.command.ChangeCharacterVersionStatusCommand;
import com.narrativex.backend.modules.character.application.port.out.CharacterVersionRepository;
import com.narrativex.backend.modules.character.domain.aggregate.CharacterVersion;
import com.narrativex.backend.shared.application.response.ApiResponse;
import com.narrativex.backend.shared.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SubmitCharacterVersionForReviewUseCase {
    private final CharacterVersionRepository versionRepository;
    private final CurrentUserId currentUserId;

    public SubmitCharacterVersionForReviewUseCase(CharacterVersionRepository versionRepository,
            CurrentUserId currentUserId) {
        this.versionRepository = versionRepository;
        this.currentUserId = currentUserId;
    }

    @Transactional
    public ApiResponse<CharacterVersion> execute(ChangeCharacterVersionStatusCommand command) {
        CharacterVersion version = versionRepository.findOwnedById(command.characterVersionId(),
            currentUserId.resolve(command.actorId()))
            .orElseThrow(() -> new ResourceNotFoundException("Character version not found"));
        version.submitForReview();
        return ApiResponse.success("Character version submitted for review", versionRepository.save(version));
    }
}
