package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.application.port.out.ProductionTimelineSourceRepository;
import com.narrativex.backend.feature.generation.application.port.out.ProductionTimelineSourceRepository.BeatSource;
import com.narrativex.backend.feature.generation.application.port.out.ProductionTimelineSourceRepository.ChapterSource;
import com.narrativex.backend.feature.generation.application.query.ProductionTimelineView;
import com.narrativex.backend.feature.generation.application.service.NarrationTextClockMapper;
import com.narrativex.backend.feature.generation.application.service.NarrationTextClockMapper.AudioRange;
import com.narrativex.backend.feature.generation.application.service.NarrationTextClockMapper.TextRange;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GetProductionTimelineUseCase {
  private static final long MAX_ALIGNMENT_TAIL_DRIFT_MS = 250L;

  private final CurrentUserId currentUserId;
  private final ProjectAccess projectAccess;
  private final ProductionTimelineSourceRepository sourceRepository;

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public ProductionTimelineView execute(UUID projectId) {
    return executeOwned(projectId, currentUserId.get());
  }

  ProductionTimelineView executeOwned(UUID projectId, String ownerId) {
    projectAccess.findOwnedProject(projectId, ownerId);
    List<ChapterSource> chapterSources = sourceRepository.findChapters(projectId, ownerId);
    if (chapterSources.isEmpty()) {
      return new ProductionTimelineView(
          projectId, null, 0L, "16:9", false, List.of(), List.of());
    }

    UUID storyVersionId = chapterSources.getFirst().storyVersionId();
    List<BeatSource> beatSources = sourceRepository.findBeats(projectId, ownerId);
    Map<UUID, List<BeatSource>> beatsByChapter = new LinkedHashMap<>();
    for (BeatSource beat : beatSources) {
      beatsByChapter.computeIfAbsent(beat.chapterId(), ignored -> new ArrayList<>()).add(beat);
    }

    String aspectRatio = firstAspectRatio(chapterSources);
    boolean oneAspectRatio =
        chapterSources.stream()
                .map(ChapterSource::aspectRatio)
                .filter(value -> value != null && !value.isBlank())
                .distinct()
                .count()
            <= 1;

    long cursorMs = 0L;
    List<ProductionTimelineView.Chapter> chapters = new ArrayList<>();
    List<ProductionTimelineView.Beat> beats = new ArrayList<>();
    boolean readyForRender = oneAspectRatio;

    for (ChapterSource chapter : chapterSources) {
      List<BeatSource> storedChapterBeats =
          beatsByChapter.getOrDefault(chapter.chapterId(), List.of());
      long chapterDurationMs = resolveChapterDuration(chapter, storedChapterBeats);
      List<BeatSource> chapterBeats =
          resolveAlignedSources(chapter, storedChapterBeats, chapterDurationMs);
      long chapterStartMs = cursorMs;
      long chapterEndMs = safeAdd(cursorMs, chapterDurationMs);
      boolean timingRepresentable = chapterBeats.isEmpty() || chapterDurationMs >= chapterBeats.size();
      boolean exactTiming = hasCompleteAlignedClock(chapterBeats, chapterDurationMs);

      List<ProductionTimelineView.Beat> plannedBeats =
          timingRepresentable
              ? planBeatTiming(chapter, chapterBeats, chapterStartMs, chapterDurationMs, exactTiming)
              : List.of();
      beats.addAll(plannedBeats);

      boolean audioReady =
          positive(chapter.audioDurationMs())
              && nonBlank(chapter.audioStorageKey())
              && positive(chapter.audioSizeBytes())
              && nonBlank(chapter.audioChecksum());
      boolean beatSetComplete =
          chapter.beatCount() > 0
              && chapterBeats.size() == chapter.beatCount()
              && plannedBeats.size() == chapter.beatCount();
      boolean assetsReady =
          beatSetComplete
              && plannedBeats.stream().allMatch(ProductionTimelineView.Beat::assetReady);
      boolean chapterReady = audioReady && exactTiming && assetsReady;
      readyForRender &= chapterReady;

      chapters.add(
          new ProductionTimelineView.Chapter(
              chapter.chapterId(),
              chapter.orderIndex(),
              chapter.title(),
              chapter.rowVersion(),
              chapter.sourceHash(),
              chapter.mediaPlanId(),
              chapter.mediaPlanRevision(),
              chapterStartMs,
              chapterEndMs,
              chapter.audioDurationMs(),
              chapter.audioStorageKey(),
              chapter.audioSizeBytes(),
              chapter.audioChecksum(),
              chapter.narrationRequestId(),
              chapter.narrationAssetId(),
              chapter.narrationAlignmentId(),
              chapter.subtitleText(),
              chapter.subtitleSpansJson(),
              chapter.beatCount(),
              chapter.readyBeatCount(),
              chapterReady));
      cursorMs = chapterEndMs;
    }

    readyForRender &= cursorMs > 0 && !beats.isEmpty();
    return new ProductionTimelineView(
        projectId,
        storyVersionId,
        cursorMs,
        aspectRatio,
        readyForRender,
        List.copyOf(chapters),
        List.copyOf(beats));
  }

  private static List<BeatSource> resolveAlignedSources(
      ChapterSource chapter, List<BeatSource> sources, long chapterDurationMs) {
    if (hasCompleteAlignedClock(sources, chapterDurationMs) || sources.isEmpty()) {
      return sources;
    }
    if (chapter.subtitleSpansJson() == null || chapter.subtitleSpansJson().isBlank()) {
      return sources;
    }

    List<TextRange> textRanges = new ArrayList<>(sources.size());
    for (BeatSource source : sources) {
      if (source.textStart() == null
          || source.textEnd() == null
          || source.textStart() < 0
          || source.textEnd() <= source.textStart()) {
        return sources;
      }
      textRanges.add(new TextRange(source.textStart(), source.textEnd()));
    }

    List<AudioRange> audioRanges =
        NarrationTextClockMapper.map(textRanges, chapter.subtitleSpansJson(), chapterDurationMs);
    if (audioRanges.size() != sources.size()) return sources;

    List<BeatSource> aligned = new ArrayList<>(sources.size());
    for (int index = 0; index < sources.size(); index++) {
      BeatSource source = sources.get(index);
      AudioRange range = audioRanges.get(index);
      aligned.add(
          new BeatSource(
              source.chapterId(),
              source.chapterOrderIndex(),
              source.mediaPlanId(),
              source.mediaPlanRevision(),
              source.sceneIndex(),
              source.beatIndex(),
              source.visualBeatId(),
              source.title(),
              source.visualIntent(),
              source.cameraMovement(),
              source.assetStrategy(),
              source.textStart(),
              source.textEnd(),
              range.audioStartMs(),
              range.audioEndMs(),
              range.durationMs(),
              source.mediaAssetId(),
              source.mediaType(),
              source.sourceDurationMs(),
              source.fitMode(),
              source.trimStartMs(),
              source.mediaSelectionActive(),
              source.storageKey(),
              source.sizeBytes(),
              source.checksum()));
    }
    return List.copyOf(aligned);
  }

  private static List<ProductionTimelineView.Beat> planBeatTiming(
      ChapterSource chapter,
      List<BeatSource> sources,
      long chapterStartMs,
      long chapterDurationMs,
      boolean exactTiming) {
    if (sources.isEmpty()) return List.of();

    if (exactTiming) {
      List<ProductionTimelineView.Beat> aligned = new ArrayList<>(sources.size());
      for (int index = 0; index < sources.size(); index++) {
        BeatSource source = sources.get(index);
        long relativeStartMs = source.audioStartMs();
        long relativeEndMs =
            index == sources.size() - 1 ? chapterDurationMs : source.audioEndMs();
        aligned.add(
            buildBeat(
                chapter,
                source,
                safeAdd(chapterStartMs, relativeStartMs),
                safeAdd(chapterStartMs, relativeEndMs)));
      }
      return List.copyOf(aligned);
    }

    long[] weights = new long[sources.size()];
    long totalWeight = 0L;
    for (int index = 0; index < sources.size(); index++) {
      BeatSource source = sources.get(index);
      long weight = resolveBeatWeight(source);
      weights[index] = weight;
      totalWeight = safeAdd(totalWeight, weight);
    }
    if (totalWeight <= 0) {
      totalWeight = sources.size();
      java.util.Arrays.fill(weights, 1L);
    }

    List<ProductionTimelineView.Beat> planned = new ArrayList<>(sources.size());
    long previousRelativeEnd = 0L;
    long cumulativeWeight = 0L;
    for (int index = 0; index < sources.size(); index++) {
      BeatSource source = sources.get(index);
      cumulativeWeight = safeAdd(cumulativeWeight, weights[index]);
      long relativeEnd;
      if (index == sources.size() - 1) {
        relativeEnd = chapterDurationMs;
      } else {
        relativeEnd = Math.round((double) chapterDurationMs * cumulativeWeight / totalWeight);
        long minimumEnd = previousRelativeEnd + 1L;
        long latestEnd = Math.max(minimumEnd, chapterDurationMs - (sources.size() - index - 1L));
        relativeEnd = Math.max(minimumEnd, Math.min(relativeEnd, latestEnd));
      }
      if (relativeEnd <= previousRelativeEnd) relativeEnd = previousRelativeEnd + 1L;
      if (relativeEnd > chapterDurationMs) relativeEnd = chapterDurationMs;

      planned.add(
          buildBeat(
              chapter,
              source,
              safeAdd(chapterStartMs, previousRelativeEnd),
              safeAdd(chapterStartMs, relativeEnd)));
      previousRelativeEnd = relativeEnd;
    }
    return List.copyOf(planned);
  }

  private static boolean hasCompleteAlignedClock(List<BeatSource> sources, long chapterDurationMs) {
    if (sources.isEmpty()) return false;
    long expectedStartMs = 0L;
    for (int index = 0; index < sources.size(); index++) {
      BeatSource source = sources.get(index);
      Long startMs = source.audioStartMs();
      Long endMs = source.audioEndMs();
      boolean isLast = index == sources.size() - 1;
      if (startMs == null
          || endMs == null
          || startMs != expectedStartMs
          || startMs < 0
          || endMs <= startMs
          || (!isLast && endMs > chapterDurationMs)) {
        return false;
      }
      expectedStartMs = endMs;
    }
    return Math.abs(expectedStartMs - chapterDurationMs) <= MAX_ALIGNMENT_TAIL_DRIFT_MS
        && sources.getLast().audioStartMs() < chapterDurationMs;
  }

  private static ProductionTimelineView.Beat buildBeat(
      ChapterSource chapter, BeatSource source, long globalStartMs, long globalEndMs) {
    long durationMs = Math.max(1L, globalEndMs - globalStartMs);
    boolean assetReady =
        source.mediaAssetId() != null
            && nonBlank(source.mediaType())
            && positive(source.sizeBytes())
            && nonBlank(source.checksum());

    return new ProductionTimelineView.Beat(
        chapter.chapterId(),
        chapter.orderIndex(),
        source.sceneIndex(),
        source.beatIndex(),
        source.visualBeatId(),
        source.title(),
        source.visualIntent(),
        source.cameraMovement(),
        source.assetStrategy(),
        source.mediaAssetId(),
        source.mediaType(),
        source.sourceDurationMs(),
        nonBlank(source.fitMode()) ? source.fitMode() : "TRIM",
        Math.max(0L, source.trimStartMs()),
        source.mediaSelectionActive(),
        source.storageKey(),
        source.sizeBytes(),
        source.checksum(),
        globalStartMs,
        globalEndMs,
        durationMs,
        assetReady);
  }

  private static long resolveBeatWeight(BeatSource source) {
    if (positive(source.audioDurationMs())) return source.audioDurationMs();
    if (source.audioStartMs() != null
        && source.audioEndMs() != null
        && source.audioEndMs() > source.audioStartMs()) {
      return source.audioEndMs() - source.audioStartMs();
    }
    return 1L;
  }

  private static long resolveChapterDuration(ChapterSource chapter, List<BeatSource> beats) {
    if (positive(chapter.audioDurationMs())) return chapter.audioDurationMs();
    if (positive(chapter.fallbackDurationMs())) return chapter.fallbackDurationMs();
    long planned = beats.stream().mapToLong(GetProductionTimelineUseCase::resolveBeatWeight).sum();
    return Math.max(planned, Math.max(1, beats.size()) * 8_000L);
  }

  private static String firstAspectRatio(List<ChapterSource> chapters) {
    return chapters.stream()
        .map(ChapterSource::aspectRatio)
        .filter(value -> value != null && !value.isBlank())
        .findFirst()
        .orElse("16:9");
  }

  private static boolean positive(Long value) {
    return value != null && value > 0;
  }

  private static boolean nonBlank(String value) {
    return value != null && !value.isBlank();
  }

  private static long safeAdd(long left, long right) {
    return Math.addExact(left, right);
  }
}
