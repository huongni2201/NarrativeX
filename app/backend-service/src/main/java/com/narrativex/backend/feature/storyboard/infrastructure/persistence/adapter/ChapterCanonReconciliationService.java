package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.CharacterRow;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.CharacterVersionRow;
import com.narrativex.backend.feature.character.infrastructure.persistence.mybatis.ProjectCharacterRow;
import com.narrativex.backend.feature.generation.application.model.analysis.AnalyzedCharacter;
import com.narrativex.backend.feature.generation.application.model.analysis.AnalyzedLocation;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterCanon;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterCanonMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ProjectCharacterBindingRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ProjectLocationBindingRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ProjectLocationRow;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * Reconciles analyzed narrative canon (characters and locations) against existing project entities.
 * Reuses existing stable project characters and locations by AI name, canonical name, or aliases.
 * Preserves locked character versions without overwriting approved history.
 */
@Service
public class ChapterCanonReconciliationService {

  private static final JsonMapper JSON = JsonMapper.builder().build();
  private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};

  private final ChapterCanonMapper canonMapper;

  public ChapterCanonReconciliationService(ChapterCanonMapper canonMapper) {
    this.canonMapper = canonMapper;
  }

  public record ReconciledCanon(
      Map<String, UUID> characterMap,
      Map<String, UUID> locationMap,
      Map<String, UUID> characterLookup,
      Map<String, UUID> locationLookup
  ) {
    public ReconciledCanon(Map<String, UUID> characterMap, Map<String, UUID> locationMap) {
      this(characterMap, locationMap, buildLookup(characterMap), buildLookup(locationMap));
    }

    private static Map<String, UUID> buildLookup(Map<String, UUID> map) {
      Map<String, UUID> lookup = new HashMap<>();
      if (map != null) {
        map.forEach((k, v) -> {
          if (k != null) lookup.put(k.trim().toLowerCase(), v);
        });
      }
      return lookup;
    }

    public UUID findCharacterId(String name) {
      if (name == null || name.isBlank() || characterLookup == null) return null;
      return characterLookup.get(name.trim().toLowerCase());
    }

    public UUID findLocationId(String name) {
      if (name == null || name.isBlank() || locationLookup == null) return null;
      return locationLookup.get(name.trim().toLowerCase());
    }
  }

  private record ReconciliationResult(Map<String, UUID> primaryMap, Map<String, UUID> lookupMap) {}

  @Transactional
  public ReconciledCanon reconcileAndPersist(UUID projectId, ChapterCanon canon) {
    Objects.requireNonNull(projectId, "projectId must not be null");
    if (canon == null) {
      return new ReconciledCanon(Map.of(), Map.of(), Map.of(), Map.of());
    }

    ReconciliationResult characters = reconcileCharacters(projectId, canon.characters());
    ReconciliationResult locations = reconcileLocations(projectId, canon.locations());

    return new ReconciledCanon(
        Collections.unmodifiableMap(characters.primaryMap()),
        Collections.unmodifiableMap(locations.primaryMap()),
        Collections.unmodifiableMap(characters.lookupMap()),
        Collections.unmodifiableMap(locations.lookupMap()));
  }

  private ReconciliationResult reconcileCharacters(UUID projectId, List<AnalyzedCharacter> analyzedList) {
    Map<String, UUID> resultMap = new HashMap<>();
    Map<String, UUID> lookupMap = new HashMap<>();
    if (analyzedList == null || analyzedList.isEmpty()) {
      return new ReconciliationResult(resultMap, lookupMap);
    }

    List<ProjectCharacterBindingRow> existing = canonMapper.findProjectCharacterBindings(projectId);
    Instant now = Instant.now();

    for (AnalyzedCharacter analyzed : analyzedList) {
      if (analyzed.aiName() == null || analyzed.aiName().isBlank()) {
        continue;
      }

      ProjectCharacterBindingRow match = findCharacterMatch(analyzed, existing);
      if (match != null) {
        UUID projectCharId = match.getProjectCharacterId();
        resultMap.put(analyzed.aiName(), projectCharId);
        indexNames(lookupMap, projectCharId, analyzed.aiName(), analyzed.canonicalName(), analyzed.aliases());
        indexNames(
            lookupMap,
            projectCharId,
            match.getAiName(),
            match.getCanonicalName(),
            parseAliases(
                match.getCharacterAliasesJson(),
                match.getAiAliasesJson(),
                match.getProjectAliasesJson()));

        // Check if pinned version is locked and appearance changed semantically
        boolean isLocked = match.getVersionLockedAt() != null
            || "LOCKED".equalsIgnoreCase(match.getVersionStatus());
        if (isLocked) {
          boolean promptChanged = analyzed.visualPrompt() != null
              && !analyzed.visualPrompt().isBlank()
              && !analyzed.visualPrompt().equals(match.getVisualPrompt());
          if (promptChanged) {
            int nextVersion = canonMapper.maxCharacterVersion(match.getCharacterId()) + 1;
            CharacterVersionRow newVersion = new CharacterVersionRow();
            newVersion.setCharacterId(match.getCharacterId());
            newVersion.setVersionNumber(nextVersion);
            newVersion.setBible(analyzed.description() != null ? analyzed.description() : "");
            newVersion.setVisualPrompt(analyzed.visualPrompt());
            newVersion.setStatus("DRAFT");
            newVersion.setCreatedAt(now);
            newVersion.setUpdatedAt(now);
            canonMapper.insertCharacterVersion(newVersion);
          }
        }

        // Update AI identity binding
        String aliasesJson = toJson(analyzed.aliases());
        canonMapper.upsertProjectCharacterAiIdentity(projectId, projectCharId, analyzed.aiName(), aliasesJson);
      } else {
        // Create new Character
        CharacterRow charRow = new CharacterRow();
        charRow.setCanonicalName(analyzed.canonicalName() != null ? analyzed.canonicalName() : analyzed.aiName());
        charRow.setAliasesJson(toJson(analyzed.aliases()));
        charRow.setStatus("ACTIVE");
        charRow.setCreatedAt(now);
        charRow.setUpdatedAt(now);
        UUID characterId = canonMapper.insertCharacter(charRow);
        charRow.setId(characterId);

        // Create initial CharacterVersion
        CharacterVersionRow versionRow = new CharacterVersionRow();
        versionRow.setCharacterId(characterId);
        versionRow.setVersionNumber(1);
        versionRow.setBible(analyzed.description() != null ? analyzed.description() : "");
        versionRow.setVisualPrompt(analyzed.visualPrompt() != null ? analyzed.visualPrompt() : "");
        versionRow.setStatus("DRAFT");
        versionRow.setCreatedAt(now);
        versionRow.setUpdatedAt(now);
        UUID versionId = canonMapper.insertCharacterVersion(versionRow);
        versionRow.setId(versionId);

        // Create ProjectCharacter
        ProjectCharacterRow projCharRow = new ProjectCharacterRow();
        projCharRow.setProjectId(projectId);
        projCharRow.setCharacterId(characterId);
        projCharRow.setRole(normalizeRole(analyzed.role()));
        projCharRow.setImportance(normalizeImportance(analyzed.importance()));
        projCharRow.setProjectAliasesJson(toJson(analyzed.aliases()));
        projCharRow.setStoryMetadata(analyzed.description());
        projCharRow.setGroupsJson("[]");
        projCharRow.setPinnedCharacterVersionId(versionId);
        projCharRow.setStatus("ACTIVE");
        projCharRow.setCreatedAt(now);
        projCharRow.setUpdatedAt(now);
        UUID projCharId = canonMapper.insertProjectCharacter(projCharRow);
        if (projCharId == null) {
          // If conflict hit, refetch
          List<ProjectCharacterBindingRow> refreshed = canonMapper.findProjectCharacterBindings(projectId);
          projCharId = refreshed.stream()
              .filter(r -> r.getCharacterId().equals(characterId))
              .map(ProjectCharacterBindingRow::getProjectCharacterId)
              .findFirst()
              .orElse(null);
        }

        if (projCharId != null) {
          resultMap.put(analyzed.aiName(), projCharId);
          indexNames(lookupMap, projCharId, analyzed.aiName(), analyzed.canonicalName(), analyzed.aliases());
          String aliasesJson = toJson(analyzed.aliases());
          canonMapper.upsertProjectCharacterAiIdentity(projectId, projCharId, analyzed.aiName(), aliasesJson);

          // Add to local existing list to prevent duplicates within same batch
          ProjectCharacterBindingRow newBinding = new ProjectCharacterBindingRow();
          newBinding.setProjectCharacterId(projCharId);
          newBinding.setProjectId(projectId);
          newBinding.setCharacterId(characterId);
          newBinding.setCanonicalName(charRow.getCanonicalName());
          newBinding.setAiName(analyzed.aiName());
          existing.add(newBinding);
        }
      }
    }

    return new ReconciliationResult(resultMap, lookupMap);
  }

  private ReconciliationResult reconcileLocations(UUID projectId, List<AnalyzedLocation> analyzedList) {
    Map<String, UUID> resultMap = new HashMap<>();
    Map<String, UUID> lookupMap = new HashMap<>();
    if (analyzedList == null || analyzedList.isEmpty()) {
      return new ReconciliationResult(resultMap, lookupMap);
    }

    List<ProjectLocationBindingRow> existing = canonMapper.findProjectLocationBindings(projectId);
    Instant now = Instant.now();

    for (AnalyzedLocation analyzed : analyzedList) {
      if (analyzed.aiName() == null || analyzed.aiName().isBlank()) {
        continue;
      }

      ProjectLocationBindingRow match = findLocationMatch(analyzed, existing);
      if (match != null) {
        UUID projectLocId = match.getProjectLocationId();
        resultMap.put(analyzed.aiName(), projectLocId);
        indexNames(lookupMap, projectLocId, analyzed.aiName(), analyzed.name(), analyzed.aliases());
        indexNames(lookupMap, projectLocId, match.getAiName(), match.getName(), parseAliases(match.getAiAliasesJson()));
        String aliasesJson = toJson(analyzed.aliases());
        canonMapper.upsertProjectLocationAiIdentity(projectId, projectLocId, analyzed.aiName(), aliasesJson);
      } else {
        ProjectLocationRow locRow = new ProjectLocationRow();
        locRow.setProjectId(projectId);
        locRow.setName(analyzed.name() != null ? analyzed.name() : analyzed.aiName());
        locRow.setDescription(analyzed.description());
        locRow.setVisualPrompt(analyzed.visualPrompt());
        locRow.setStatus("ACTIVE");
        locRow.setCreatedAt(now);
        locRow.setUpdatedAt(now);
        UUID locId = canonMapper.insertProjectLocation(locRow);
        locRow.setId(locId);

        resultMap.put(analyzed.aiName(), locId);
        indexNames(lookupMap, locId, analyzed.aiName(), analyzed.name(), analyzed.aliases());
        String aliasesJson = toJson(analyzed.aliases());
        canonMapper.upsertProjectLocationAiIdentity(projectId, locId, analyzed.aiName(), aliasesJson);

        // Add to local existing list to prevent duplicate insertions within same batch
        ProjectLocationBindingRow newBinding = new ProjectLocationBindingRow();
        newBinding.setProjectLocationId(locId);
        newBinding.setProjectId(projectId);
        newBinding.setName(locRow.getName());
        newBinding.setAiName(analyzed.aiName());
        existing.add(newBinding);
      }
    }

    return new ReconciliationResult(resultMap, lookupMap);
  }

  private static void indexName(Map<String, UUID> lookup, UUID id, String name) {
    if (name != null && !name.isBlank()) {
      lookup.putIfAbsent(name.trim().toLowerCase(), id);
    }
  }

  private static void indexNames(
      Map<String, UUID> lookup,
      UUID id,
      String primaryName,
      String secondaryName,
      List<String> aliases) {
    indexName(lookup, id, primaryName);
    indexName(lookup, id, secondaryName);
    if (aliases != null) {
      for (String a : aliases) {
        indexName(lookup, id, a);
      }
    }
  }

  private ProjectCharacterBindingRow findCharacterMatch(
      AnalyzedCharacter analyzed, List<ProjectCharacterBindingRow> existing) {
    String aiName = analyzed.aiName();
    String canonical = analyzed.canonicalName();
    Set<String> searchNames = new HashSet<>();
    if (aiName != null) searchNames.add(aiName.trim().toLowerCase());
    if (canonical != null) searchNames.add(canonical.trim().toLowerCase());
    if (analyzed.aliases() != null) {
      for (String a : analyzed.aliases()) {
        if (a != null && !a.isBlank()) searchNames.add(a.trim().toLowerCase());
      }
    }

    for (ProjectCharacterBindingRow candidate : existing) {
      if (candidate.getAiName() != null && searchNames.contains(candidate.getAiName().trim().toLowerCase())) {
        return candidate;
      }
      if (candidate.getCanonicalName() != null && searchNames.contains(candidate.getCanonicalName().trim().toLowerCase())) {
        return candidate;
      }
      List<String> candidateAliases = parseAliases(candidate.getCharacterAliasesJson(), candidate.getAiAliasesJson(), candidate.getProjectAliasesJson());
      for (String ca : candidateAliases) {
        if (searchNames.contains(ca.trim().toLowerCase())) {
          return candidate;
        }
      }
    }
    return null;
  }

  private ProjectLocationBindingRow findLocationMatch(
      AnalyzedLocation analyzed, List<ProjectLocationBindingRow> existing) {
    String aiName = analyzed.aiName();
    String name = analyzed.name();
    Set<String> searchNames = new HashSet<>();
    if (aiName != null) searchNames.add(aiName.trim().toLowerCase());
    if (name != null) searchNames.add(name.trim().toLowerCase());
    if (analyzed.aliases() != null) {
      for (String a : analyzed.aliases()) {
        if (a != null && !a.isBlank()) searchNames.add(a.trim().toLowerCase());
      }
    }

    for (ProjectLocationBindingRow candidate : existing) {
      if (candidate.getAiName() != null && searchNames.contains(candidate.getAiName().trim().toLowerCase())) {
        return candidate;
      }
      if (candidate.getName() != null && searchNames.contains(candidate.getName().trim().toLowerCase())) {
        return candidate;
      }
      List<String> candidateAliases = parseAliases(candidate.getAiAliasesJson());
      for (String ca : candidateAliases) {
        if (searchNames.contains(ca.trim().toLowerCase())) {
          return candidate;
        }
      }
    }
    return null;
  }

  private List<String> parseAliases(String... jsonBlobs) {
    List<String> result = new ArrayList<>();
    for (String blob : jsonBlobs) {
      if (blob != null && !blob.isBlank()) {
        try {
          List<String> items = JSON.readValue(blob, STRING_LIST);
          if (items != null) {
            result.addAll(items);
          }
        } catch (Exception ignored) {}
      }
    }
    return result;
  }

  private static String toJson(List<String> list) {
    if (list == null || list.isEmpty()) {
      return "[]";
    }
    try {
      return JSON.writeValueAsString(list);
    } catch (Exception e) {
      return "[]";
    }
  }

  private static String normalizeRole(String role) {
    if (role == null) return "SUPPORTING";
    String upper = role.trim().toUpperCase();
    return switch (upper) {
      case "PROTAGONIST", "MAIN", "HERO", "LEAD" -> "PROTAGONIST";
      case "ANTAGONIST", "VILLAIN" -> "ANTAGONIST";
      case "EXTRA", "BACKGROUND" -> "EXTRA";
      default -> "SUPPORTING";
    };
  }

  private static String normalizeImportance(String importance) {
    if (importance == null) return "SECONDARY";
    String upper = importance.trim().toUpperCase();
    return switch (upper) {
      case "PRIMARY", "MAIN", "HIGH" -> "PRIMARY";
      case "BACKGROUND", "LOW", "EXTRA" -> "BACKGROUND";
      default -> "SECONDARY";
    };
  }
}
