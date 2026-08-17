# DDD migration command evidence

Date: 2026-08-17 (Asia/Saigon)

## Backend compile

Command: `mvn -q -DskipTests compile`  
Working directory: `D:\workplace\NarrativeX\app\backend-service`  
Runtime/tool version: Java 25.0.3, Maven 3.9.16, Spring Boot 4.1.0  
Result: PASS  
Notes: Initial sandboxed dependency resolution was blocked by `Permission denied: getsockopt`; the approved Maven fallback resolved dependencies successfully.

## Backend full tests

Command: `mvn -q clean test`  
Working directory: `D:\workplace\NarrativeX\app\backend-service`  
Runtime/tool version: Java 25.0.3, Maven 3.9.16  
Result: PASS  
Tests: 15 tests, 0 failures, 0 errors  
Notes: Includes architecture rules, framework-free domain tests, Project aggregate tests, generation use-case test, API error tests, and Spring context startup. The context uses H2 and does not validate a fresh PostgreSQL database.

## Static dependency checks

Command: ripgrep checks for framework imports in domain, API/infrastructure imports in application, outbound ports/infrastructure imports in API, and legacy service/repository names  
Working directory: `D:\workplace\NarrativeX`  
Runtime/tool version: ripgrep (installed)  
Result: PASS  
Notes: Domain models are framework-free; application and API dependency direction is clean; old JPA-in-domain service/repository names are absent from production source.

## Diff hygiene

Command: `git diff --check`  
Working directory: `D:\workplace\NarrativeX`  
Runtime/tool version: Git (installed)  
Result: PASS  
Notes: Git may emit normal LF/CRLF normalization warnings; no whitespace errors remain.

## Deferred verification

Fresh PostgreSQL/Flyway validation remains a W1-D4 concern. The migration intentionally does not add a database migration or provider/worker integration.
