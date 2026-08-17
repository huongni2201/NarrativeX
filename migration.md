You are working on the NarrativeX repository.

Repository root:
NarrativeX

Backend:
app/backend-service

Frontend:
app/frontend-web

GOAL

Perform an atomic backend + frontend API contract migration.

NarrativeX will NO LONGER use Spring ProblemDetail as its public API error contract.

The final REST API contract must be:

Successful response:
    ApiResponse<T>

Successful paginated response:
    ApiResponse<PaginationResponse<T>>

Failed response:
    ErrorResponse

Final architecture:

2xx
 └── ApiResponse<T>

2xx paginated
 └── ApiResponse<PaginationResponse<T>>

4xx / 5xx
 └── ErrorResponse

The frontend must also migrate completely away from ApiProblem / ProblemDetail.

Do not leave mixed public API error formats after this migration.

==================================================
1. IMPORTANT MIGRATION PRINCIPLE
==================================================

This is an API contract migration affecting both backend and frontend.

Backend and frontend must be updated together.

Do not stop after making backend compile.

Do not stop after making frontend compile.

Inspect all REST API call sites and all error handling paths.

Preserve HTTP semantics:

GET success        -> 200
POST create        -> 201
async AI enqueue   -> 202
DELETE no body     -> 204
validation         -> 400
authentication     -> 401
authorization      -> 403
not found          -> 404
conflict           -> 409
unexpected failure -> 500

ApiResponse.success=true does NOT mean all successful endpoints should return HTTP 200.

ErrorResponse.success=false does NOT mean errors should return HTTP 200.

==================================================
2. CREATE ApiResponse
==================================================

Create:

app/backend-service/src/main/java/com/narrativex/backend/shared/api/ApiResponse.java

Use:

package com.narrativex.backend.shared.api;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(
    boolean success,
    String message,
    T data,
    Instant timestamp
) {

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(
            true,
            "Success",
            data,
            Instant.now()
        );
    }

    public static <T> ApiResponse<T> success(
        String message,
        T data
    ) {
        return new ApiResponse<>(
            true,
            message,
            data,
            Instant.now()
        );
    }

    public static ApiResponse<Void> success() {
        return new ApiResponse<>(
            true,
            "Success",
            null,
            Instant.now()
        );
    }

    public static ApiResponse<Void> success(String message) {
        return new ApiResponse<>(
            true,
            message,
            null,
            Instant.now()
        );
    }
}

Do NOT add error factory methods to ApiResponse.

Error payloads use ErrorResponse.

==================================================
3. CREATE PaginationResponse
==================================================

Create:

app/backend-service/src/main/java/com/narrativex/backend/shared/api/PaginationResponse.java

Use:

package com.narrativex.backend.shared.api;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

public record PaginationResponse<T>(
    List<T> content,
    int page,
    int size,
    long totalElements,
    int totalPages,
    boolean first,
    boolean last,
    boolean hasNext,
    boolean hasPrevious
) {

    public static <T> PaginationResponse<T> from(Page<T> page) {
        return new PaginationResponse<>(
            page.getContent(),
            page.getNumber(),
            page.getSize(),
            page.getTotalElements(),
            page.getTotalPages(),
            page.isFirst(),
            page.isLast(),
            page.hasNext(),
            page.hasPrevious()
        );
    }

    public static <S, T> PaginationResponse<T> from(
        Page<S> page,
        Function<S, T> mapper
    ) {
        return new PaginationResponse<>(
            page.getContent()
                .stream()
                .map(mapper)
                .toList(),
            page.getNumber(),
            page.getSize(),
            page.getTotalElements(),
            page.getTotalPages(),
            page.isFirst(),
            page.isLast(),
            page.hasNext(),
            page.hasPrevious()
        );
    }
}

==================================================
4. CREATE ErrorResponse
==================================================

Create:

app/backend-service/src/main/java/com/narrativex/backend/shared/api/ErrorResponse.java

Reuse the existing FieldViolation DTO where possible.

Use:

package com.narrativex.backend.shared.api;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(
    boolean success,
    int status,
    String code,
    String message,
    String path,
    String correlationId,
    List<FieldViolation> errors,
    Instant timestamp
) {

    public static ErrorResponse of(
        int status,
        String code,
        String message,
        String path,
        String correlationId
    ) {
        return new ErrorResponse(
            false,
            status,
            code,
            message,
            path,
            correlationId,
            null,
            Instant.now()
        );
    }

    public static ErrorResponse validation(
        int status,
        String code,
        String message,
        String path,
        String correlationId,
        List<FieldViolation> errors
    ) {
        return new ErrorResponse(
            false,
            status,
            code,
            message,
            path,
            correlationId,
            errors,
            Instant.now()
        );
    }
}

==================================================
5. REMOVE PROBLEMDETAIL FROM PUBLIC API CONTRACT
==================================================

Inspect:

app/backend-service/src/main/java/com/narrativex/backend/shared/api/

especially:

- ApiExceptionHandler
- ApiProblemFactory
- ApiProblemWriter
- ApiAuthenticationEntryPoint
- ApiAccessDeniedHandler
- ApiErrorCode
- CorrelationIdFilter
- FieldViolation

The existing implementation currently produces Spring ProblemDetail.

Migrate all APPLICATION API error responses to ErrorResponse.

Do NOT expose ProblemDetail from NarrativeX REST APIs after this migration.

ApiExceptionHandler must return ResponseEntity<ErrorResponse> or ErrorResponse with appropriate status.

Do not preserve ProblemDetail merely for compatibility because the frontend is being migrated atomically.

==================================================
6. ApiExceptionHandler MIGRATION
==================================================

Rewrite the central exception handlers to produce ErrorResponse.

Handle at least:

IllegalArgumentException
    -> 400 INVALID_REQUEST

MethodArgumentNotValidException
    -> 400 VALIDATION_FAILED

ResourceNotFoundException
    -> 404 RESOURCE_NOT_FOUND

ResourceConflictException
    -> 409 RESOURCE_CONFLICT

OptimisticLockException
ObjectOptimisticLockingFailureException
    -> 409 RESOURCE_CONFLICT

AuthenticationException
    -> 401 UNAUTHORIZED

AccessDeniedException
    -> 403 FORBIDDEN

unexpected Exception
    -> 500 INTERNAL_ERROR

All error responses must contain:

success = false
status
code
message
path
correlationId when available
timestamp

Validation errors must additionally contain:

errors

with structured FieldViolation objects.

Do not expose stack traces or internal exception details.

==================================================
7. PRESERVE CORRELATION ID
==================================================

Do NOT remove CorrelationIdFilter.

Every ErrorResponse should include correlationId whenever available.

Preserve the current response correlation ID header behavior.

The frontend uses correlationId for diagnostics/support.

==================================================
8. SECURITY ERROR MIGRATION
==================================================

Authentication failures may occur before @RestControllerAdvice.

Therefore inspect and migrate:

ApiAuthenticationEntryPoint

and:

ApiAccessDeniedHandler

They must output the SAME ErrorResponse JSON contract.

Expected examples:

401:

{
  "success": false,
  "status": 401,
  "code": "UNAUTHORIZED",
  "message": "Authentication is required.",
  "path": "/api/v1/...",
  "correlationId": "...",
  "timestamp": "..."
}

403:

{
  "success": false,
  "status": 403,
  "code": "FORBIDDEN",
  "message": "Access denied.",
  "path": "/api/v1/...",
  "correlationId": "...",
  "timestamp": "..."
}

Ensure Content-Type is application/json.

==================================================
9. ApiProblemFactory / ApiProblemWriter CLEANUP
==================================================

After migration inspect:

ApiProblemFactory
ApiProblemWriter

If they are no longer referenced:

delete them.

Do not leave dead ProblemDetail infrastructure in the repository.

However:

Do NOT delete:
- ApiErrorCode
- FieldViolation
- CorrelationIdFilter

if they remain useful for ErrorResponse.

Search all backend usages before deleting any class.

==================================================
10. SUCCESS CONTROLLER MIGRATION
==================================================

Inspect all normal business REST controllers.

Wrap normal JSON success payloads.

BEFORE:

public ProjectResponse get(...)

AFTER:

public ApiResponse<ProjectResponse> get(...)

Example:

return ApiResponse.success(response);

For meaningful commands:

return ApiResponse.success(
    "Project created successfully",
    response
);

Maintain HTTP status annotations.

Example:

@PostMapping
@ResponseStatus(HttpStatus.CREATED)
public ApiResponse<ProjectResponse> create(...) {
    ...
}

must still return HTTP 201.

==================================================
11. ASYNC AI JOBS
==================================================

NarrativeX performs asynchronous AI work.

Do not change this semantic.

Example:

POST /api/v1/projects/{projectId}/analysis-jobs

must remain:

HTTP 202 Accepted

Response:

{
  "success": true,
  "message": "Story analysis job queued",
  "data": {
    ...
  },
  "timestamp": "..."
}

Do NOT convert async AI operations into synchronous endpoints.

==================================================
12. DO NOT WRAP PROTOCOL PAYLOADS
==================================================

Do not blindly wrap every controller response.

Do NOT wrap:

- SSE event payloads
- media streaming
- image/video binary responses
- downloads
- redirect responses
- actuator responses
- WebSocket protocol messages
- internal job-event schema payloads

The ApiResponse/ErrorResponse contract applies to normal NarrativeX REST JSON APIs.

SSE and job-event contracts must remain independently versioned.

==================================================
13. PAGINATION
==================================================

Migrate suitable collection endpoints to:

ApiResponse<PaginationResponse<T>>

Prioritize data sets that can grow:

- projects
- characters
- generation jobs
- assets
- chapters
- scenes
- story versions
- character versions

Only implement pagination where it is real database-level pagination.

Use:

Pageable
Page<T>

Do NOT:

fetch all rows
then subList(...)
then call it pagination.

Default:

page = 0
size = 20

Maximum recommended page size:

100

If the project already has a central configuration pattern for limits, use it.

==================================================
14. FRONTEND TYPES
==================================================

Modify:

app/frontend-web/src/types/api.ts

Remove the public ProblemDetail model.

Remove:

ApiProblem

unless another non-public use genuinely remains.

Introduce:

export interface ApiResponse<T> {
  success: true;
  message: string;
  data: T;
  timestamp: string;
}

export interface PaginationResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface ApiFieldError {
  field: string;
  code?: string;
  message?: string;
}

export interface ErrorResponse {
  success: false;
  status: number;
  code: string;
  message: string;
  path?: string;
  correlationId?: string;
  errors?: ApiFieldError[];
  timestamp: string;
}

Do NOT model errors as ProblemDetail after this migration.

==================================================
15. FRONTEND ApiClientError
==================================================

Keep a dedicated ApiClientError but migrate it to ErrorResponse.

Recommended shape:

export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly correlationId?: string;
  readonly errors?: ApiFieldError[];
  readonly response: ErrorResponse;

  constructor(response: ErrorResponse) {
    super(response.message);

    this.name = "ApiClientError";
    this.status = response.status;
    this.code = response.code;
    this.correlationId = response.correlationId;
    this.errors = response.errors;
    this.response = response;
  }
}

Adapt naming to existing code style where appropriate.

==================================================
16. REMOVE parseProblem
==================================================

The frontend currently has ProblemDetail-oriented parsing.

Remove or replace:

parseProblem()

with:

parseErrorResponse()

The new HTTP error flow should conceptually be:

if (!response.ok) {
    const errorResponse =
        await parseErrorResponse(response);

    throw new ApiClientError(errorResponse);
}

Do not check application/problem+json.

The backend now returns ErrorResponse as JSON.

==================================================
17. DEFENSIVE ERROR PARSING
==================================================

The HTTP client still needs a fallback when:

- proxy returns an unexpected response
- server returns invalid JSON
- network infrastructure returns HTML
- backend crashes before normal JSON serialization

Implement defensive parsing.

Example conceptual fallback:

{
  success: false,
  status: response.status,
  code: "HTTP_ERROR",
  message: response.statusText || "Request failed",
  timestamp: new Date().toISOString()
}

Do not cause another exception while trying to parse an error.

==================================================
18. SUCCESS UNWRAPPING
==================================================

The frontend HTTP transport layer should understand ApiResponse<T>.

Feature code should continue receiving domain data.

Preferred:

request<T>(...) => Promise<T>

Internally:

const envelope =
    await response.json() as ApiResponse<T>;

return envelope.data;

Therefore:

const project =
    await api.createProject(input);

NOT:

const envelope =
    await api.createProject(input);

const project =
    envelope.data;

Keep transport-envelope knowledge centralized in:

src/lib/api.ts

==================================================
19. 204 RESPONSES
==================================================

HTTP 204 has no body.

Do not attempt to parse ApiResponse from 204.

Handle first:

if (response.status === 204) {
    return undefined as T;
}

This is an intentional exception to the ApiResponse success envelope because HTTP 204 must not contain a response body.

==================================================
20. FRONTEND PAGINATION
==================================================

Paginated API functions should return:

Promise<PaginationResponse<T>>

NOT:

Promise<ApiResponse<PaginationResponse<T>>>

because request() unwraps ApiResponse.data.

Example:

listProjects(params): Promise<PaginationResponse<ApiProject>>

Usage:

const result = await api.listProjects({
  page: 0,
  size: 20
});

result.content
result.totalElements
result.hasNext

==================================================
21. TANSTACK QUERY
==================================================

Preserve TanStack Query integration.

For paginated endpoints include pagination state in the query key.

Good:

["projects", page, size]

Bad:

["projects"]

when multiple pages exist.

If sorting/filtering is used, include those values in the query key as well.

==================================================
22. VALIDATION ERROR UI
==================================================

Search frontend forms for backend validation handling.

Migrate field errors to:

ErrorResponse.errors

Example:

error.errors?.forEach(fieldError => {
  // bind fieldError.message to matching form field
});

Do not parse ProblemDetail.violations anymore.

Preserve the ability to display:

field
code
message

==================================================
23. ERROR TOASTS
==================================================

Search all error toasts/messages.

Prefer:

ApiClientError.message

and optionally:

for translation.

For unexpected errors show a safe generic message.

Do not display raw stack traces or internal backend exception messages.

==================================================
24. CONTENT TYPES
==================================================

Normal success API responses:

Content-Type:
application/json

Normal ErrorResponse responses:

Content-Type:
application/json

Frontend should no longer depend on:

application/problem+json

Search for:

application/problem+json

and migrate application API usages.

Do not change unrelated external protocol handling.

==================================================
25. BACKEND TESTS
==================================================

Update or add tests for:

1. Standard ApiResponse success.

2. GET returns:
   success=true
   data
   timestamp

3. POST create remains 201.

4. AI job enqueue remains 202.

5. Validation error returns ErrorResponse.

6. Validation ErrorResponse:
   success=false
   status=400
   code=VALIDATION_FAILED
   errors=[...]

7. 401 returns ErrorResponse.

8. 403 returns ErrorResponse.

9. 404 returns ErrorResponse.

10. 409 returns ErrorResponse.

11. 500 returns ErrorResponse without exposing sensitive exception information.

12. correlationId is present where expected.

13. application/problem+json is no longer required for these errors.

14. pagination metadata is correct.

==================================================
26. FRONTEND TESTS
==================================================

Update tests to verify:

success envelope is unwrapped.

Example server payload:

{
  "success": true,
  "message": "Success",
  "data": {...},
  "timestamp": "..."
}

must produce the domain object.

Error payload:

{
  "success": false,
  "status": 404,
  "code": "RESOURCE_NOT_FOUND",
  "message": "Project not found",
  "correlationId": "...",
  "timestamp": "..."
}

must produce ApiClientError.

Validation errors must expose field errors.

Also test invalid/non-JSON HTTP error fallback.

==================================================
27. SEARCH FOR OLD CONTRACT
==================================================

After implementation search the ENTIRE repository for:

ProblemDetail
ApiProblem
ApiProblemFactory
ApiProblemWriter
parseProblem
application/problem+json
violations

Inspect every result.

Do not blindly delete third-party/framework usage.

But NarrativeX application REST APIs and frontend client must not rely on the old ProblemDetail contract.

Also search:

request<ApiProject[]>
request<ApiProject>
request<ApiGenerationJob>

and ensure success envelope unwrapping is correct.

==================================================
28. DO NOT BREAK SSE / JOB EVENTS
==================================================

NarrativeX has asynchronous worker/event architecture.

Do not change the job event schema merely because REST API responses are migrating.

Do NOT wrap SSE messages in ApiResponse.

Do NOT wrap Redis worker events in ApiResponse.

Do NOT modify versioned job-event contract unless specifically required by an existing failing integration.

REST response contracts and async event contracts are separate concerns.

==================================================
29. DELETE DEAD CODE
==================================================

After migration:

remove backend ProblemDetail helpers that are genuinely unused.

remove frontend ApiProblem types that are genuinely unused.

remove parseProblem if unused.

remove application/problem+json-specific code if unused.

Do NOT leave duplicate error systems.

But verify all references before deletion.

==================================================
30. BUILD AND TEST
==================================================

Backend:

run the backend Maven test suite using the repository's normal Maven wrapper/command.

Frontend:

run:
npm run lint
npm run build

and tests if configured.

Fix all migration regressions.

Do NOT solve TypeScript errors using:

any
@ts-ignore
@ts-expect-error

unless there is a documented, unavoidable reason.

==================================================
31. REQUIRED FINAL CONTRACT
==================================================

The finished NarrativeX REST contract must be:

SUCCESS OBJECT

{
  "success": true,
  "message": "Project retrieved successfully",
  "data": {
    ...
  },
  "timestamp": "..."
}


SUCCESS PAGINATION

{
  "success": true,
  "message": "Projects retrieved successfully",
  "data": {
    "content": [],
    "page": 0,
    "size": 20,
    "totalElements": 0,
    "totalPages": 0,
    "first": true,
    "last": true,
    "hasNext": false,
    "hasPrevious": false
  },
  "timestamp": "..."
}


ERROR

{
  "success": false,
  "status": 400,
  "code": "VALIDATION_FAILED",
  "message": "Request validation failed.",
  "path": "/api/v1/projects",
  "correlationId": "...",
  "errors": [
    {
      "field": "name",
      "code": "NotBlank",
      "message": "Project name is required"
    }
  ],
  "timestamp": "..."
}

==================================================
32. REQUIRED FINAL REPORT
==================================================

When complete report:

1. New files created.
2. Files modified.
3. Files deleted.
4. Controllers migrated.
5. Success endpoints migrated.
6. Pagination endpoints migrated.
7. Error handlers migrated.
8. Security handlers migrated.
9. Old ProblemDetail classes removed or intentionally retained.
10. Frontend ApiProblem usages removed.
11. Frontend request layer changes.
12. Frontend form validation changes.
13. Pagination call sites updated.
14. SSE/binary endpoints intentionally excluded.
15. Backend test result.
16. Frontend test result.
17. Frontend lint result.
18. Frontend build result.
19. Remaining contract inconsistencies, if any.

Do not claim full completion while both ErrorResponse and ProblemDetail remain active for the same NarrativeX application REST API surface.