# W1-D2 Command Evidence

Audit date: 2026-08-17  
Baseline: `e192278e7f25139041a51f1b3d5ff67f2d955c97` on `main`  
Environment: Windows 11, Java 25.0.3, Maven 3.9.16, Node 26.4.0, npm 11.17.0

## Repository safety

Command: `git status --short`  
Working directory: `D:\workplace\NarrativeX`  
Runtime/tool version: Git (installed)  
Timestamp: 2026-08-17T20:00+07:00  
Exit code: 0  
Result: PASS  
First actionable error: none  
Predates W1-D2?: YES  
Notes: Existing user changes were present before implementation: a ProjectApplicationService formatting edit, deleted W1-D2 plan, `documentation/execution/`, and the detailed W1-D2 prompt. They were preserved.

Command: `git rev-parse HEAD` and `git branch --show-current`  
Working directory: `D:\workplace\NarrativeX`  
Runtime/tool version: Git (installed)  
Timestamp: 2026-08-17T20:00+07:00  
Exit code: 0  
Result: PASS  
First actionable error: none  
Predates W1-D2?: YES  
Notes: HEAD `e192278e7f25139041a51f1b3d5ff67f2d955c97`; branch `main`.

## Backend

Command: `.\mvnw.cmd -Dtest=ArchitectureRulesTest test`  
Working directory: `D:\workplace\NarrativeX\app\backend-service`  
Runtime/tool version: Java 25.0.3; Maven wrapper  
Timestamp: 2026-08-17T20:14+07:00  
Exit code: 1  
Result: BLOCKED  
First actionable error: `icm : Cannot index into a null array` / `Cannot start maven from wrapper`  
Predates W1-D2?: YES  
Notes: This is the documented W1-D1 Windows wrapper failure and occurs before Maven starts. The wrapper was not modified.

Command: `mvn -Dtest=ArchitectureRulesTest,ApiExceptionHandlerTest,CorrelationIdFilterTest,GenerationApplicationServiceTest test`  
Working directory: `D:\workplace\NarrativeX\app\backend-service`  
Runtime/tool version: Maven 3.9.16; Java 25.0.3; Spring Boot 4.1.0  
Timestamp: 2026-08-17T20:18:36+07:00  
Exit code: 0  
Result: PASS  
First actionable error: none  
Predates W1-D2?: NO  
Notes: 9 tests passed, including architecture, ProblemDetail/correlation, and generation application-boundary coverage.

Command: `mvn test`  
Working directory: `D:\workplace\NarrativeX\app\backend-service`  
Runtime/tool version: Maven 3.9.16; Java 25.0.3; Spring Boot 4.1.0  
Timestamp: 2026-08-17T20:30:27+07:00  
Exit code: 0  
Result: PASS  
First actionable error: none  
Predates W1-D2?: NO  
Notes: 13 tests passed. The existing test profile remains H2 and does not close the W1-D4 clean PostgreSQL/Flyway gate.

## Frontend

Command: `npm ci`  
Working directory: `D:\workplace\NarrativeX\app\frontend-web`  
Runtime/tool version: Node 26.4.0; npm 11.17.0  
Timestamp: 2026-08-17T20:19+07:00  
Exit code: 1  
Result: BLOCKED  
First actionable error: `EPERM: operation not permitted, unlink ...node_modules/@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node`  
Predates W1-D2?: YES  
Notes: Existing `node_modules` contained a locked native Next.js binary. The command was retried with elevated access and failed with the same EPERM. No source or lockfile change was made by npm ci.

Command: `npm install --offline --ignore-scripts` (fallback environment repair)  
Working directory: `D:\workplace\NarrativeX\app\frontend-web`  
Runtime/tool version: Node 26.4.0; npm 11.17.0  
Timestamp: 2026-08-17T20:22+07:00  
Exit code: 0  
Result: PASS  
First actionable error: none; npm reported cleanup warning for the same locked native binary  
Predates W1-D2?: YES  
Notes: Recreated missing executable links from the existing offline cache so the requested lint/type/build checks could run. This was not reported as `npm ci` success.

Command: `npm run lint`  
Working directory: `D:\workplace\NarrativeX\app\frontend-web`  
Runtime/tool version: Next.js 16.3.1; ESLint 9  
Timestamp: 2026-08-17T20:24+07:00  
Exit code: 0  
Result: PASS  
First actionable error: none  
Predates W1-D2?: YES  
Notes: 23 existing `@next/next/no-img-element` warnings; zero errors.

Command: `npm run type-check`  
Working directory: `D:\workplace\NarrativeX\app\frontend-web`  
Runtime/tool version: TypeScript 5.8.2  
Timestamp: 2026-08-17T20:26+07:00  
Exit code: 0  
Result: PASS  
First actionable error: none  
Predates W1-D2?: NO  
Notes: Passed after mapping the unreachable legacy dashboard to API DTO types.

Command: `npm run build`  
Working directory: `D:\workplace\NarrativeX\app\frontend-web`  
Runtime/tool version: Next.js 16.3.1 / Turbopack; Node 26.4.0  
Timestamp: 2026-08-17T20:28+07:00  
Exit code: 0  
Result: PASS  
First actionable error: none  
Predates W1-D2?: NO  
Notes: Production build compiled, type-checked, generated six static pages, and completed optimization.

## Static boundary checks

Command: `rg -n "modules\\.project\\.repository" app/backend-service/src/main/java/com/narrativex/backend/modules/generation`  
Working directory: `D:\workplace\NarrativeX`  
Runtime/tool version: ripgrep (installed)  
Timestamp: 2026-08-17T20:29+07:00  
Exit code: 1 (no matches)  
Result: PASS  
First actionable error: none; no generation-to-project-repository import exists  
Predates W1-D2?: NO  
Notes: The broader repository search still shows same-module repository imports, which are allowed.

Command: equivalent Windows-safe ripgrep checks for API/application/repository, domain runtime imports, frontend fetch/mock/query usage  
Working directory: `D:\workplace\NarrativeX`  
Runtime/tool version: ripgrep (installed)  
Timestamp: 2026-08-17T20:29+07:00  
Exit code: 0  
Result: PASS  
First actionable error: none  
Predates W1-D2?: NO  
Notes: Matches are expected API package declarations/controllers, the single centralized frontend `fetch`, explicitly gated mock stores, and the new QueryClient foundation. ArchitectureRulesTest is the authoritative automated guard.

Command: `git diff --check`  
Working directory: `D:\workplace\NarrativeX`  
Runtime/tool version: Git (installed)  
Timestamp: 2026-08-17T20:29+07:00  
Exit code: 0  
Result: PASS  
First actionable error: none  
Predates W1-D2?: NO  
Notes: Git emitted normal LF/CRLF normalization warnings only.

Command: `rg -n "jacoco|coverage" app/backend-service/pom.xml CONTRIBUTING.md documentation/plans/week-1/README.md`  
Working directory: `D:\workplace\NarrativeX`  
Runtime/tool version: ripgrep (installed)  
Timestamp: 2026-08-17T20:29+07:00  
Exit code: 1 (no matches)  
Result: BLOCKED  
First actionable error: No repository-native coverage configuration was found.  
Predates W1-D2?: YES  
Notes: No coverage number is claimed; the repository has no JaCoCo/coverage task configured.
