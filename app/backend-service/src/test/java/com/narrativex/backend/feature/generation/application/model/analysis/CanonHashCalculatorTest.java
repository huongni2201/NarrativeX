package com.narrativex.backend.feature.generation.application.model.analysis;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;

class CanonHashCalculatorTest {

  @Test
  void sameCanon_producesSameHash() {
    ChapterCanon canon1 =
        new ChapterCanon(
            List.of(
                new AnalyzedCharacter(
                    "hero",
                    "Hero Name",
                    List.of("The Champion", "Chosen One"),
                    "PROTAGONIST",
                    "PRIMARY",
                    "A brave hero",
                    "hero prompt")),
            List.of(
                new AnalyzedLocation(
                    "citadel", "The Citadel", List.of("High Castle"), "A fortress", "castle prompt")));

    ChapterCanon canon2 =
        new ChapterCanon(
            List.of(
                new AnalyzedCharacter(
                    "hero",
                    "Hero Name",
                    List.of("The Champion", "Chosen One"),
                    "PROTAGONIST",
                    "PRIMARY",
                    "A brave hero",
                    "hero prompt")),
            List.of(
                new AnalyzedLocation(
                    "citadel", "The Citadel", List.of("High Castle"), "A fortress", "castle prompt")));

    String hash1 = CanonHashCalculator.computeCanonHash(canon1);
    String hash2 = CanonHashCalculator.computeCanonHash(canon2);

    assertNotNull(hash1);
    assertEquals(64, hash1.length());
    assertTrue(hash1.matches("^[0-9a-f]{64}$"));
    assertEquals(hash1, hash2);
  }

  @Test
  void fieldOrderDifferences_produceSameHash() {
    String jsonA =
        """
        {
          "canon": {
            "characters": [
              {
                "ai_name": "bob",
                "canonical_name": "Bob",
                "aliases": ["bobby", "b"],
                "role": "SUPPORTING",
                "importance": "SECONDARY",
                "description": "Friend",
                "visual_prompt": "prompt B"
              },
              {
                "ai_name": "alice",
                "canonical_name": "Alice",
                "aliases": ["ali"],
                "role": "PROTAGONIST",
                "importance": "PRIMARY",
                "description": "Heroine",
                "visual_prompt": "prompt A"
              }
            ],
            "locations": [
              {
                "ai_name": "tavern",
                "name": "The Tavern",
                "aliases": ["Inn"],
                "description": "Warm place",
                "visual_prompt": "tavern prompt"
              }
            ]
          }
        }
        """;

    // Different array order (alice first, then bob), different key order in objects, different alias order
    String jsonB =
        """
        {
          "canon": {
            "locations": [
              {
                "visual_prompt": "tavern prompt",
                "description": "Warm place",
                "aliases": ["Inn"],
                "name": "The Tavern",
                "ai_name": "tavern"
              }
            ],
            "characters": [
              {
                "visual_prompt": "prompt A",
                "description": "Heroine",
                "importance": "PRIMARY",
                "role": "PROTAGONIST",
                "aliases": ["ali"],
                "canonical_name": "Alice",
                "ai_name": "alice"
              },
              {
                "visual_prompt": "prompt B",
                "importance": "SECONDARY",
                "description": "Friend",
                "role": "SUPPORTING",
                "aliases": ["b", "bobby"],
                "canonical_name": "Bob",
                "ai_name": "bob"
              }
            ]
          }
        }
        """;

    String hashA = CanonHashCalculator.computeCanonHash(jsonA);
    String hashB = CanonHashCalculator.computeCanonHash(jsonB);

    assertEquals(hashA, hashB, "Hash must be invariant to JSON field order and character array order");
  }

  @Test
  void canonChange_producesDifferentHash() {
    ChapterCanon baseCanon =
        new ChapterCanon(
            List.of(
                new AnalyzedCharacter(
                    "hero",
                    "Hero Name",
                    List.of(),
                    "PROTAGONIST",
                    "PRIMARY",
                    "A brave hero",
                    "hero prompt")),
            List.of());

    ChapterCanon modifiedCanon =
        new ChapterCanon(
            List.of(
                new AnalyzedCharacter(
                    "hero",
                    "Hero Name",
                    List.of(),
                    "PROTAGONIST",
                    "PRIMARY",
                    "A wounded hero", // Changed description
                    "hero prompt")),
            List.of());

    String hashBase = CanonHashCalculator.computeCanonHash(baseCanon);
    String hashModified = CanonHashCalculator.computeCanonHash(modifiedCanon);

    assertNotEquals(hashBase, hashModified, "Changing canon data must produce a different canonHash");
  }

  @Test
  void sceneProseChange_doesNotAffectCanonHash() {
    String jsonWithScene1 =
        """
        {
          "canon": {
            "characters": [
              {"ai_name": "alice", "canonical_name": "Alice"}
            ],
            "locations": []
          },
          "scenes": [
            {"title": "Scene 1: Peaceful morning in the village", "narration": "The sun rose over the hills."}
          ]
        }
        """;

    String jsonWithScene2 =
        """
        {
          "scenes": [
            {"title": "Scene 99: Terrifying dragon attack at midnight", "narration": "Fire rained down from the sky."}
          ],
          "canon": {
            "characters": [
              {"ai_name": "alice", "canonical_name": "Alice"}
            ],
            "locations": []
          }
        }
        """;

    String hash1 = CanonHashCalculator.computeCanonHash(jsonWithScene1);
    String hash2 = CanonHashCalculator.computeCanonHash(jsonWithScene2);

    assertEquals(hash1, hash2, "Canon hash must be strictly invariant to scene prose/title differences");
  }

  @Test
  void emptyOrNullCanon_producesDeterministicHash() {
    String hashNull = CanonHashCalculator.computeCanonHash((ChapterCanon) null);
    String hashEmptyString = CanonHashCalculator.computeCanonHash("");
    String hashEmptyObject = CanonHashCalculator.computeCanonHash("{}");

    assertNotNull(hashNull);
    assertEquals(64, hashNull.length());
    assertTrue(hashNull.matches("^[0-9a-f]{64}$"));

    assertEquals(hashNull, hashEmptyString);
    assertEquals(hashNull, hashEmptyObject);
  }
}
