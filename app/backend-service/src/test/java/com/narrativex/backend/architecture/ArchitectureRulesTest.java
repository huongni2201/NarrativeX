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

    @Test void productionPackagesRespectDependencyDirectionAndNaming() throws IOException { List<String> violations=scanProductionSources();assertTrue(violations.isEmpty(),()->String.join(System.lineSeparator(),violations)); }
    @Test void aggregateRootDoesNotInheritDomainEntity() throws IOException { String source=Files.readString(SOURCE_ROOT.resolve("modules/common/domain/AggregateRoot.java"));assertTrue(!source.contains("extends DomainEntity")); }
    @Test void rulesDetectRepresentativeInvalidDependencies() {
        assertTrue(isForbiddenApplicationImport("project","import com.narrativex.backend.modules.project.api.request.CreateProjectRequest;"));
        assertTrue(isForbiddenApplicationImport("project","import com.narrativex.backend.modules.character.api.response.CharacterResponse;"));
        assertTrue(isForbiddenApplicationImport("project","import com.narrativex.backend.modules.project.infrastructure.persistence.adapter.ProjectPersistenceAdapter;"));
        assertTrue(isForbiddenApiImport("import com.narrativex.backend.modules.project.application.port.out.ProjectRepository;"));
        assertTrue(isForbiddenDomainImport("import jakarta.persistence.Entity;"));
    }

    private static List<String> scanProductionSources() throws IOException {
        List<String> violations=new ArrayList<>();
        try(Stream<Path> paths=Files.walk(SOURCE_ROOT)) { paths.filter(path->path.toString().endsWith(".java")).forEach(path->{ try {
            String source=Files.readString(path);String pkg=packageName(source);String relative=SOURCE_ROOT.relativize(path).toString().replace('\\','/');String fileName=path.getFileName().toString();String module=moduleName(pkg);
            if(pkg.contains(".application")&&source.lines().anyMatch(line->isForbiddenApplicationImport(module,line))) violations.add(relative+": application imports a forbidden API/infrastructure package");
            if(pkg.contains(".api")&&source.lines().anyMatch(ArchitectureRulesTest::isForbiddenApiImport)) violations.add(relative+": API imports infrastructure/outbound port");
            if(pkg.contains(".domain")&&source.lines().anyMatch(ArchitectureRulesTest::isForbiddenDomainImport)) violations.add(relative+": domain imports framework/infrastructure");
            if(pkg.startsWith("com.narrativex.backend.modules.common")&&source.lines().anyMatch(line->line.startsWith("import com.narrativex.backend.modules.")&&!line.contains(".modules.common."))) violations.add(relative+": common imports a business module");
            if(source.contains("@RestController")&&!pkg.contains(".api.")) violations.add(relative+": REST controller is outside API");
            if(fileName.endsWith("Command.java")&&!pkg.contains(".application.command")) violations.add(relative+": command is outside application/command");
            if(fileName.endsWith("Query.java")&&!pkg.contains(".application.query")) violations.add(relative+": query is outside application/query");
            if(fileName.endsWith("UseCase.java")&&!source.contains("ApiResponse<")) violations.add(relative+": external use case must return ApiResponse<T>");
            if(relative.contains("/application/response/")) violations.add(relative+": feature responses belong in api/response");
            if(source.contains("extends AggregateRoot")&&!relative.contains("/domain/aggregate/")) violations.add(relative+": AggregateRoot subclass must live in domain/aggregate");
            if(source.contains("extends DomainEntity")&&!relative.contains("/domain/entity/")) violations.add(relative+": DomainEntity subclass must live in domain/entity");
            if(relative.contains("/domain/aggregate/enums/")) violations.add(relative+": enums belong in domain/enums");
            if(source.contains("com.narrativex.backend.shared")) violations.add(relative+": legacy shared package reference remains");
        } catch(IOException e){throw new IllegalStateException("Unable to inspect "+path,e);} }); }
        return violations;
    }
    private static String packageName(String source){return source.lines().filter(line->line.startsWith("package ")).map(line->line.substring(8,line.length()-1)).findFirst().orElse("");}
    private static String moduleName(String pkg){String marker="com.narrativex.backend.modules.";if(!pkg.startsWith(marker))return "";String rest=pkg.substring(marker.length());int dot=rest.indexOf('.');return dot<0?rest:rest.substring(0,dot);}
    private static boolean isForbiddenApplicationImport(String module,String line){if(!line.startsWith("import com.narrativex.backend.modules."))return false;if(line.contains(".infrastructure.")||line.contains(".api.controller.")||line.contains(".api.request."))return true;if(line.contains(".api.response.")){String imported=moduleName(line.substring("import ".length(),line.length()-1));return !module.equals(imported);}return false;}
    private static boolean isForbiddenApiImport(String line){return line.startsWith("import ")&&(line.contains(".infrastructure.")||line.contains(".application.port.out."));}
    private static boolean isForbiddenDomainImport(String line){if(!line.startsWith("import "))return false;String lower=line.toLowerCase();return lower.startsWith("import jakarta.persistence")||lower.startsWith("import jakarta.validation")||lower.startsWith("import org.springframework")||lower.contains(".infrastructure.")||lower.contains("redis")||lower.contains("minio")||lower.contains("software.amazon")||lower.contains("narrativex_worker");}
}
