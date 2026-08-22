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
  void migratedProjectAdaptersDoNotDependOnJpaOrJdbc() throws IOException {
    List<String> files =
        List.of(
            "feature/project/infrastructure/persistence/adapter/MyBatisProjectRepository.java",
            "feature/project/infrastructure/persistence/adapter/MyBatisProjectOverviewQueryAdapter.java",
            "feature/project/infrastructure/persistence/adapter/MyBatisProjectResourceQueryAdapter.java",
            "feature/project/infrastructure/persistence/mybatis/ProjectMapper.java",
            "feature/project/infrastructure/persistence/mybatis/ProjectQueryMapper.java");

    for (String file : files) {
      String source = Files.readString(SOURCE_ROOT.resolve(file));
      assertTrue(!source.contains("jakarta.persistence"), () -> file + " imports JPA");
      assertTrue(!source.contains("JpaRepository"), () -> file + " imports Spring Data JPA");
      assertTrue(!source.contains("JdbcTemplate"), () -> file + " imports JdbcTemplate");
      assertTrue(
          !source.contains("NamedParameterJdbcTemplate"),
          () -> file + " imports NamedParameterJdbcTemplate");
    }
  }

  @Test
  void generationDurableAdaptersUseMyBatisOnly() throws IOException {
    List<String> files =
        List.of(
            "feature/generation/infrastructure/persistence/adapter/MyBatisGenerationJobPersistenceAdapter.java",
            "feature/generation/infrastructure/persistence/adapter/StageAttemptPersistenceAdapter.java",
            "feature/generation/infrastructure/persistence/adapter/OperationPlanPersistenceAdapter.java",
            "feature/generation/infrastructure/persistence/adapter/GenerationOutboxPersistenceAdapter.java",
            "feature/generation/infrastructure/persistence/adapter/MyBatisJobHistoryQueryAdapter.java",
            "feature/generation/infrastructure/persistence/adapter/MyBatisChapterAnalysisSafetyGate.java",
            "feature/generation/infrastructure/persistence/adapter/MyBatisMediaPlanPersistenceAdapter.java");

    for (String file : files) {
      String source = Files.readString(SOURCE_ROOT.resolve(file));
      assertTrue(!source.contains("jakarta.persistence"), () -> file + " imports JPA");
      assertTrue(!source.contains("JpaRepository"), () -> file + " imports Spring Data JPA");
      assertTrue(!source.contains("JdbcTemplate"), () -> file + " imports JdbcTemplate");
      assertTrue(
          source.contains("infrastructure.persistence.mybatis"),
          () -> file + " does not use a dedicated MyBatis mapper/row");
    }

    assertTrue(
        !Files.exists(
            SOURCE_ROOT.resolve(
                "feature/generation/infrastructure/persistence/entity/StageAttemptJpaEntity.java")));
    assertTrue(
        !Files.exists(
            SOURCE_ROOT.resolve(
                "feature/generation/infrastructure/persistence/entity/OperationPlanJpaEntity.java")));
    assertTrue(
        !Files.exists(
            SOURCE_ROOT.resolve(
                "feature/generation/infrastructure/persistence/repository/StageAttemptJpaRepository.java")));
    assertTrue(
        !Files.exists(
            SOURCE_ROOT.resolve(
                "feature/generation/infrastructure/persistence/repository/OperationPlanJpaRepository.java")));
  }

  @Test
  void productionPersistenceDoesNotContainJpaOrJdbcTemplate() throws IOException {
    List<String> violations = new ArrayList<>();
    try (Stream<Path> paths = Files.walk(SOURCE_ROOT)) {
      paths
          .filter(path -> path.toString().endsWith(".java"))
          .forEach(
              path -> {
                try {
                  String source = Files.readString(path);
                  if (source.contains("jakarta.persistence")
                      || source.contains("org.springframework.data.jpa")
                      || source.contains("org.springframework.orm")
                      || source.contains("org.hibernate")
                      || source.contains("JdbcTemplate")
                      || source.contains("NamedParameterJdbcTemplate")
                      || source.contains("JdbcClient")
                      || source.contains("org.springframework.jdbc.core")) {
                    violations.add(SOURCE_ROOT.relativize(path).toString());
                  }
                } catch (IOException exception) {
                  throw new IllegalStateException("Unable to inspect " + path, exception);
                }
              });
    }
    assertTrue(violations.isEmpty(), () -> "Legacy persistence references: " + violations);
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
            "import"
                + " com.narrativex.backend.feature.project.infrastructure.persistence.adapter.MyBatisProjectRepository;"));
    assertTrue(
        isForbiddenApplicationImport(
            "storyboard", "import org.springframework.jdbc.core.JdbcTemplate;"));
    assertTrue(
        isForbiddenApplicationImport(
            "storyboard", "import org.springframework.data.jpa.repository.JpaRepository;"));
    assertTrue(
        isForbiddenApplicationImport("storyboard", "import jakarta.persistence.EntityManager;"));
    assertTrue(
        isForbiddenApiImport(
            "import"
                + " com.narrativex.backend.feature.project.application.port.out.ProjectRepository;"));
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
          relative
              + ": application imports a forbidden feature/API/infrastructure/framework package");
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
    if (line.startsWith("import org.springframework.jdbc.")
        || line.startsWith("import org.springframework.data.jpa.")
        || line.startsWith("import jakarta.persistence.")) {
      return true;
    }
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
