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

    private static final Path SOURCE_ROOT = Path.of("src/main/java/com/narrativex/backend");

    @Test
    void productionPackagesRespectDependencyDirectionAndNaming() throws IOException {
        List<String> violations = scanProductionSources();
        assertTrue(violations.isEmpty(), () -> String.join(System.lineSeparator(), violations));
    }

    @Test
    void aggregateRootDoesNotInheritDomainEntity() throws IOException {
        String source = Files.readString(SOURCE_ROOT.resolve("shared/domain/AggregateRoot.java"));
        assertTrue(!source.contains("extends DomainEntity"),
            "AggregateRoot must own aggregate identity semantics instead of extending DomainEntity");
    }

    @Test
    void rulesDetectRepresentativeInvalidDependencies() {
        assertTrue(isForbiddenApplicationImport(
            "import com.narrativex.backend.modules.project.api.request.CreateProjectRequest;"));
        assertTrue(isForbiddenApplicationImport(
            "import com.narrativex.backend.modules.project.infrastructure.persistence.adapter.ProjectPersistenceAdapter;"));
        assertTrue(isForbiddenApiImport(
            "import com.narrativex.backend.modules.project.application.port.out.ProjectRepository;"));
        assertTrue(isForbiddenDomainImport("import jakarta.persistence.Entity;"));
    }

    private static List<String> scanProductionSources() throws IOException {
        List<String> violations = new ArrayList<>();
        try (Stream<Path> paths = Files.walk(SOURCE_ROOT)) {
            paths.filter(path -> path.toString().endsWith(".java")).forEach(path -> {
                try {
                    String source = Files.readString(path);
                    String packageName = packageName(source);
                    String relative = SOURCE_ROOT.relativize(path).toString().replace('\\', '/');
                    String fileName = path.getFileName().toString();

                    if (packageName.contains(".application")
                        && source.lines().anyMatch(ArchitectureRulesTest::isForbiddenApplicationImport)) {
                        violations.add(relative + ": application imports an API or infrastructure package");
                    }
                    if (packageName.contains(".api")
                        && source.lines().anyMatch(ArchitectureRulesTest::isForbiddenApiImport)) {
                        violations.add(relative + ": API imports an infrastructure or outbound port package");
                    }
                    if (packageName.contains(".domain")
                        && source.lines().anyMatch(ArchitectureRulesTest::isForbiddenDomainImport)) {
                        violations.add(relative + ": domain imports a framework or infrastructure dependency");
                    }
                    if (packageName.contains(".shared")
                        && source.lines().anyMatch(line -> line.contains("com.narrativex.backend.modules."))) {
                        violations.add(relative + ": shared imports a business module");
                    }
                    if (source.contains("@RestController") && !packageName.contains(".api")) {
                        violations.add(relative + ": REST controller is outside an API package");
                    }
                    if (fileName.endsWith("Command.java") && !packageName.contains(".application.command")) {
                        violations.add(relative + ": command is outside application/command");
                    }
                    if (fileName.endsWith("Query.java") && !packageName.contains(".application.query")) {
                        violations.add(relative + ": query is outside application/query");
                    }
                    if (fileName.endsWith("UseCase.java") && !source.contains("ApiResponse<")) {
                        violations.add(relative + ": external-facing use case must return ApiResponse<T>");
                    }
                } catch (IOException exception) {
                    throw new IllegalStateException("Unable to inspect " + path, exception);
                }
            });
        }
        return violations;
    }

    private static String packageName(String source) {
        return source.lines().filter(line -> line.startsWith("package "))
            .map(line -> line.substring("package ".length(), line.length() - 1))
            .findFirst().orElse("");
    }

    private static boolean isForbiddenApplicationImport(String line) {
        return line.startsWith("import ") && line.contains("com.narrativex.backend.modules.")
            && (line.contains(".api.") || line.contains(".infrastructure."));
    }

    private static boolean isForbiddenApiImport(String line) {
        return line.startsWith("import ")
            && (line.contains(".infrastructure.") || line.contains(".application.port.out."));
    }

    private static boolean isForbiddenDomainImport(String line) {
        if (!line.startsWith("import ")) {
            return false;
        }
        String lower = line.toLowerCase();
        return lower.startsWith("import jakarta.persistence")
            || lower.startsWith("import jakarta.validation")
            || lower.startsWith("import org.springframework")
            || lower.contains("shared.infrastructure")
            || lower.contains("redis")
            || lower.contains("minio")
            || lower.contains("software.amazon")
            || lower.contains("provider")
            || lower.contains("narrativex_worker");
    }
}
