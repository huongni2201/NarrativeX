package com.narrativex.backend.feature.storyboard.application.service;

import com.narrativex.backend.feature.common.hashing.Sha256;
import com.narrativex.backend.feature.storyboard.application.service.SourceUnitSegmenter.SourceUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * Turns model-chosen source unit indexes into UTF-16 text ranges (ADR-0006).
 *
 * <p>The model never copies source text. It names the unit where each visual beat starts; the
 * backend derives {@code textStart/textEnd} from its own deterministic segmentation. Beats tile the
 * chapter: a beat runs from its start unit to the unit before the next beat starts, and the first
 * beat always covers from unit 0, which matches the production clock. A first beat that names a
 * later unit is tolerated and still starts at 0, so the chapter stays gap-free ({@code
 * ChapterAnalysisArtifactMaterializer#validate} reports it so the model can correct it). Anything
 * out of range or out of order fails closed.
 */
@Component
public class SourceAnchorResolver {
  private static final JsonMapper JSON = JsonMapper.builder().build();
  private static final Pattern SHA256_HEX_PATTERN = Pattern.compile("^[0-9a-f]{64}$");

  /** The segmented chapter together with the source hash that ranges are bound to. */
  public record SourceUnits(String normalizedSource, String sourceHash, List<SourceUnit> units) {}

  public record ResolvedSourceAnchor(
      int textStart,
      int textEnd,
      String sourceHash,
      String sourceAnchorJson,
      int firstUnit,
      int lastUnit) {}

  public SourceUnits units(String sourceText, String sourceHash) {
    List<SourceUnit> units = SourceUnitSegmenter.segment(sourceText);
    String normalized = SourceUnitSegmenter.normalize(sourceText);
    String effectiveHash =
        sourceHash != null && SHA256_HEX_PATTERN.matcher(sourceHash).matches()
            ? sourceHash
            : Sha256.hexUtf8(normalized);
    return new SourceUnits(normalized, effectiveHash, units);
  }

  /**
   * One range per visual beat, in beat order. {@code startUnits} are the model's {@code start_unit}
   * values.
   */
  public List<ResolvedSourceAnchor> resolveBeats(SourceUnits source, List<Integer> startUnits) {
    if (startUnits == null || startUnits.isEmpty()) {
      throw new IllegalArgumentException("start_unit list must not be null or empty");
    }
    int unitCount = source.units().size();
    List<Integer> firsts = new ArrayList<>(startUnits.size());
    for (int beat = 0; beat < startUnits.size(); beat++) {
      int start = startUnits.get(beat);
      if (start < 0 || start >= unitCount) {
        throw new IllegalArgumentException(
            "visual beat "
                + beat
                + " start_unit "
                + start
                + " is outside the chapter's "
                + unitCount
                + " units");
      }
      if (beat > 0 && start <= firsts.get(beat - 1)) {
        throw new IllegalArgumentException(
            "visual beat "
                + beat
                + " start_unit "
                + start
                + " must be greater than the previous beat's "
                + firsts.get(beat - 1));
      }
      firsts.add(beat == 0 ? 0 : start);
    }
    List<ResolvedSourceAnchor> resolved = new ArrayList<>(firsts.size());
    for (int beat = 0; beat < firsts.size(); beat++) {
      int last = beat + 1 < firsts.size() ? firsts.get(beat + 1) - 1 : unitCount - 1;
      resolved.add(range(source, firsts.get(beat), last));
    }
    return resolved;
  }

  /** The range of units {@code firstUnit..lastUnit} (inclusive). */
  public ResolvedSourceAnchor range(SourceUnits source, int firstUnit, int lastUnit) {
    List<SourceUnit> units = source.units();
    if (firstUnit < 0 || lastUnit < firstUnit || lastUnit >= units.size()) {
      throw new IllegalArgumentException(
          "Invalid unit range [" + firstUnit + ", " + lastUnit + "]");
    }
    int start = units.get(firstUnit).start();
    int end = units.get(lastUnit).end();
    return new ResolvedSourceAnchor(
        start,
        end,
        source.sourceHash(),
        buildSourceAnchorJson(start, end, source.sourceHash()),
        firstUnit,
        lastUnit);
  }

  public String buildSourceAnchorJson(int textStart, int textEnd, String sourceHash) {
    if (textStart < 0 || textEnd <= textStart) {
      throw new IllegalArgumentException(
          "Invalid text range: [" + textStart + ", " + textEnd + "]");
    }
    if (sourceHash == null || !SHA256_HEX_PATTERN.matcher(sourceHash).matches()) {
      throw new IllegalArgumentException("sourceHash must be a 64-character lowercase hex string");
    }
    try {
      return JSON.writeValueAsString(new SourceAnchorJsonPayload(textStart, textEnd, sourceHash));
    } catch (Exception e) {
      throw new IllegalStateException("Failed to serialize source_anchor_json", e);
    }
  }

  private record SourceAnchorJsonPayload(int textStart, int textEnd, String sourceHash) {}
}
