package com.narrativex.backend.architecture;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

class ArchitectureRulesTest {
  private static final String ROOT_PACKAGE = "com.narrativex.backend.feature.";
  private static final Path SOURCE_ROOT = Path.of("src/main/java/com/narrativex/backend");

  @Test
  void productionPackagesRespectDependencyDirectionAndNaming() throws IOException {
    List<String> violations = scanProductionSources();
    assertTrue(violations.isEmpty(), () -> String.join(System.lineSeparator(), violations));
  }

  @Test
  void aggregateRootDoesNotInheritDomainEntity() throws IOException {
    String source =
        Files.readString(SOURCE_ROOT.resolve("feature/common/domain/AggregateRoot.java"));
    assertTrue(!source.contains("extends DomainEntity"));
  }

  @Test
  void rulesDetectRepresentativeInvalidDependencies() {
    assertTrue(
        isForbiddenApplicationImport(
            "project",
            "import com.narrativex.backend.feature.project.api.request.CreateProjectRequest;"));
    assertTrue(
        isForbiddenApplicationImport(
            "project",
            "import com.narrativex.backend.feature.character.api.response.CharacterResponse;"));
    assertTrue(
        isForbiddenApplicationImport(
            "project",
            "import com.narrativex.backend.feature.project.infrastructure.persistence.adapter.ProjectPersistenceAdapter;"));
    assertTrue(
        isForbiddenApiImport(
            "import com.narrativex.backend.feature.project.application.port.out.ProjectRepository;"));
    assertTrue(
        isForbiddenDomainImport(
            "storyboard",
            "import com.narrativex.backend.feature.project.domain.enums.AspectRatio;"));
    assertTrue(isForbiddenDomainImport("project", "import jakarta.persistence.Entity;"));
  }

  private static List<String> scanProductionSources() throws IOException {
    List<String> violations = new ArrayList<>();
    try (Stream<Path> paths = Files.walk(SOURCE_ROOT)) {
      paths
          .filter(path -> path.toString().endsWith(".java"))
          .forEach(
              path -> {
                try {
                  inspectSource(path, violations);
                } catch (IOException exception) {
                  throw new IllegalStateException("Unable to inspect " + path, exception);
                }
              });
    }
    return violations;
  }

  private static void inspectSource(Path path, List<String> violations) throws IOException {
    String source = Files.readString(path);
    String packageName = packageName(source);
    String relative = SOURCE_ROOT.relativize(path).toString().replace('\\', '/');
    String fileName = path.getFileName().toString();
    String feature = featureName(packageName);

    if (packageName.contains(".application")
        && source.lines().anyMatch(line -> isForbiddenApplicationImport(feature, line))) {
      violations.add(
          relative + ": application imports a forbidden feature/API/infrastructure package");
    }
    if (isApiPackage(packageName)
        && source.lines().anyMatch(ArchitectureRulesTest::isForbiddenApiImport)) {
      violations.add(relative + ": API imports infrastructure/outbound port");
    }
    if (packageName.contains(".domain")
        && source.lines().anyMatch(line -> isForbiddenDomainImport(feature, line))) {
      violations.add(relative + ": domain imports framework/infrastructure/another feature domain");
    }
    if (packageName.startsWith(ROOT_PACKAGE + "common")
        && source.lines().anyMatch(ArchitectureRulesTest::commonImportsBusinessFeature)) {
      violations.add(relative + ": common imports a business feature");
    }
    if (hasRestControllerAnnotation(source) && !isApiPackage(packageName)) {
      violations.add(relative + ": REST controller is outside API");
    }
    if (fileName.endsWith("Command.java") && !packageName.contains(".application.command")) {
      violations.add(relative + ": command is outside application/command");
    }
    if (fileName.endsWith("Query.java") && !packageName.contains(".application.query")) {
      violations.add(relative + ": query is outside application/query");
    }
    if (fileName.endsWith("UseCase.java") && !source.contains("ApiResponse<")) {
      violations.add(relative + ": external use case must return ApiResponse<T>");
    }
    if (relative.contains("/application/response/")) {
      violations.add(relative + ": feature responses belong in api/response");
    }
    if (source.contains("extends AggregateRoot") && !relative.contains("/domain/aggregate/")) {
      violations.add(relative + ": AggregateRoot subclass must live in domain/aggregate");
    }
    if (source.contains("extends DomainEntity") && !relative.contains("/domain/entity/")) {
      violations.add(relative + ": DomainEntity subclass must live in domain/entity");
    }
    if (relative.contains("/domain/aggregate/enums/")) {
      violations.add(relative + ": enums belong in domain/enums");
    }
    if (source.contains("com.narrativex.backend.modules")
        || source.contains("com.narrativex.backend.shared")) {
      violations.add(relative + ": legacy package reference remains");
    }
  }

  private static boolean hasRestControllerAnnotation(String source) {
    return source.lines().map(String::strip).anyMatch("@RestController"::equals);
  }

  private static boolean isApiPackage(String packageName) {
    return packageName.endsWith(".api") || packageName.contains(".api.");
  }

  private static String packageName(String source) {
    return source
        .lines()
        .filter(line -> line.startsWith("package "))
        .map(line -> line.substring(8, line.length() - 1))
        .findFirst()
        .orElse("");
  }

  private static String featureName(String packageName) {
    if (!packageName.startsWith(ROOT_PACKAGE)) {
      return "";
    }
    String rest = packageName.substring(ROOT_PACKAGE.length());
    int dot = rest.indexOf('.');
    return dot < 0 ? rest : rest.substring(0, dot);
  }

  private static String importedFeature(String line) {
    if (!line.startsWith("import " + ROOT_PACKAGE)) {
      return "";
    }
    String importedPackage = line.substring("import ".length(), line.length() - 1);
    return featureName(importedPackage);
  }

  private static boolean isForbiddenApplicationImport(String feature, String line) {
    if (!line.startsWith("import " + ROOT_PACKAGE)) {
      return false;
    }
    if (line.contains(".infrastructure.")
        || line.contains(".api.controller.")
        || line.contains(".api.request.")) {
      return true;
    }

    String importedFeature = importedFeature(line);
    if (!importedFeature.isEmpty()
        && !feature.equals(importedFeature)
        && !"common".equals(importedFeature)) {
      return !line.contains(".application.port.in.");
    }
    if (line.contains(".api.response.")) {
      return !feature.equals(importedFeature);
    }
    return false;
  }

  private static boolean isForbiddenApiImport(String line) {
    return line.startsWith("import ")
        && (line.contains(".infrastructure.") || line.contains(".application.port.out."));
  }

  private static boolean isForbiddenDomainImport(String feature, String line) {
    if (!line.startsWith("import ")) {
      return false;
    }

    String lower = line.toLowerCase();
    if (lower.startsWith("import jakarta.persistence")
        || lower.startsWith("import jakarta.validation")
        || lower.startsWith("import org.springframework")
        || lower.contains(".infrastructure.")
        || lower.contains("redis")
        || lower.contains("minio")
        || lower.contains("software.amazon")
        || lower.contains("narrativex_worker")) {
      return true;
    }

    String importedFeature = importedFeature(line);
    return !importedFeature.isEmpty()
        && !feature.equals(importedFeature)
        && !"common".equals(importedFeature);
  }

  private static boolean commonImportsBusinessFeature(String line) {
    if (!line.startsWith("import " + ROOT_PACKAGE)) {
      return false;
    }
    String importedFeature = importedFeature(line);
    return !importedFeature.isEmpty() && !"common".equals(importedFeature);
  }
}
