package com.narrativex.backend.feature.generation.application.model.analysis;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * Computes deterministic SHA-256 canon hashes for chapter continuity according to ADR-0022.
 * Canon is canonicalized by sorting characters and locations by ai_name, sorting alias arrays,
 * and serializing with alphabetical key ordering, ensuring invariance to JSON field ordering
 * or raw scene prose differences.
 */
public final class CanonHashCalculator {
  private static final JsonMapper MAPPER = JsonMapper.builder().build();

  private CanonHashCalculator() {}

  public static String computeCanonHash(ChapterCanon canon) {
    String canonicalJson = canonicalize(canon);
    return sha256(canonicalJson);
  }

  public static String computeCanonHash(String rawJson) {
    ChapterCanon canon = ChapterCanonParser.parse(rawJson);
    return computeCanonHash(canon);
  }

  public static String canonicalize(ChapterCanon canon) {
    if (canon == null) {
      canon = new ChapterCanon(List.of(), List.of());
    }

    List<AnalyzedCharacter> sortedChars = new ArrayList<>(canon.characters());
    sortedChars.sort(Comparator.comparing(c -> c.aiName().toLowerCase(Locale.ROOT)));

    List<AnalyzedLocation> sortedLocs = new ArrayList<>(canon.locations());
    sortedLocs.sort(Comparator.comparing(l -> l.aiName().toLowerCase(Locale.ROOT)));

    ObjectNode root = MAPPER.createObjectNode();

    ArrayNode charsArray = MAPPER.createArrayNode();
    for (AnalyzedCharacter c : sortedChars) {
      ObjectNode charNode = MAPPER.createObjectNode();
      charNode.put("ai_name", c.aiName());
      ArrayNode aliasesNode = MAPPER.createArrayNode();
      List<String> aliases = new ArrayList<>(c.aliases());
      Collections.sort(aliases);
      for (String a : aliases) {
        aliasesNode.add(a);
      }
      charNode.set("aliases", aliasesNode);
      charNode.put("canonical_name", c.canonicalName());
      charNode.put("description", c.description());
      charNode.put("importance", c.importance());
      charNode.put("role", c.role());
      charNode.put("visual_prompt", c.visualPrompt());
      charsArray.add(charNode);
    }
    root.set("characters", charsArray);

    ArrayNode locsArray = MAPPER.createArrayNode();
    for (AnalyzedLocation l : sortedLocs) {
      ObjectNode locNode = MAPPER.createObjectNode();
      locNode.put("ai_name", l.aiName());
      ArrayNode aliasesNode = MAPPER.createArrayNode();
      List<String> aliases = new ArrayList<>(l.aliases());
      Collections.sort(aliases);
      for (String a : aliases) {
        aliasesNode.add(a);
      }
      locNode.set("aliases", aliasesNode);
      locNode.put("description", l.description());
      locNode.put("name", l.name());
      locNode.put("visual_prompt", l.visualPrompt());
      locsArray.add(locNode);
    }
    root.set("locations", locsArray);

    try {
      return MAPPER.writeValueAsString(root);
    } catch (Exception e) {
      throw new IllegalStateException("Failed to serialize canonical canon", e);
    }
  }

  public static String sha256(String input) {
    if (input == null) {
      input = "";
    }
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(hash);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 algorithm not available", e);
    }
  }
}
