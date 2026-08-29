package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.model.VoiceReferenceSelection;
import com.narrativex.backend.feature.generation.application.port.out.NarrationOperationRepository;
import com.narrativex.backend.feature.generation.application.port.out.NarrationRequestRepository;
import com.narrativex.backend.feature.generation.domain.entity.NarrationOperation;
import com.narrativex.backend.feature.generation.domain.entity.NarrationRequest;
import com.narrativex.backend.feature.generation.domain.enums.VoiceReferenceScope;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.NarrationMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.NarrationOperationRow;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.NarrationRequestRow;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisNarrationPersistenceAdapter
    implements NarrationRequestRepository, NarrationOperationRepository {
  private final NarrationMapper mapper;

  @Override
  public NarrationRequest save(NarrationRequest request) {
    int affected = mapper.insertRequest(toRow(request));
    if (affected == 1) return request;
    return findByFingerprint(request.requestFingerprint())
        .orElseThrow(() -> new IllegalStateException("Narration request insert disappeared"));
  }

  @Override
  public Optional<NarrationRequest> findByFingerprint(String requestFingerprint) {
    return Optional.ofNullable(mapper.findRequestByFingerprint(requestFingerprint))
        .map(MyBatisNarrationPersistenceAdapter::toDomain);
  }

  @Override
  public NarrationOperation save(NarrationOperation operation) {
    if (mapper.insertOperation(
            new NarrationOperationRow(
                operation.id(),
                operation.narrationRequestId(),
                operation.generationJobId(),
                operation.stageAttemptId()))
        != 1) {
      throw new IllegalStateException(
          "Narration operation already exists for job or stage attempt");
    }
    return operation;
  }

  private static NarrationRequestRow toRow(NarrationRequest request) {
    VoiceReferenceSelection selection = request.voiceReference();
    return new NarrationRequestRow(
        request.id(),
        request.projectId(),
        request.chapterId(),
        request.chapterRowVersion(),
        request.sourceHash(),
        request.sourceText(),
        request.voiceId(),
        request.language(),
        request.speakingRate(),
        request.segmentationVersion(),
        request.requestFingerprint(),
        selection != null && selection.scope() == VoiceReferenceScope.PROJECT
            ? selection.assetId()
            : null,
        selection != null && selection.scope() == VoiceReferenceScope.ACCOUNT
            ? selection.assetId()
            : null);
  }

  private static NarrationRequest toDomain(NarrationRequestRow row) {
    VoiceReferenceSelection selection = null;
    if (row.projectVoiceReferenceAssetId() != null) {
      selection =
          new VoiceReferenceSelection(
              VoiceReferenceScope.PROJECT, row.projectVoiceReferenceAssetId());
    } else if (row.accountVoiceReferenceAssetId() != null) {
      selection =
          new VoiceReferenceSelection(
              VoiceReferenceScope.ACCOUNT, row.accountVoiceReferenceAssetId());
    }
    return new NarrationRequest(
        row.id(),
        row.projectId(),
        row.chapterId(),
        row.chapterRowVersion(),
        row.sourceHash(),
        row.sourceText(),
        row.voiceId(),
        row.language(),
        row.speakingRate(),
        row.segmentationVersion(),
        row.requestFingerprint(),
        selection);
  }
}
