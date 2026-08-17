# NarrativeX Backend Service

## Purpose
The Backend Service is the core application and domain authority of NarrativeX. It coordinates business workflows, manages persistence, enforces authorization and business rules, dispatches asynchronous generation jobs, and serves as the single API gateway for clients.

## Technology Stack
- **Language**: Java 25
- **Framework**: Spring Boot 4
- **Persistence**: Spring Data JPA, PostgreSQL Driver, Flyway Migration
- **Caching & Messaging**: Spring Data Redis
- **Security**: Spring Security
- **Observability**: Spring Boot Actuator
- **Build Tool**: Maven with Maven Wrapper
- **Testing**: JUnit 5, Spring Boot Test, Testcontainers

## Local Prerequisites
- Java 25+ JDK installed
- Maven 3.9+ (or use included `./mvnw` / `mvnw.cmd`)
- Docker (optional, for running local PostgreSQL and Redis or Testcontainers)

## Development Commands

### Run Locally
```bash
# Unix
./mvnw spring-boot:run

# Windows
.\mvnw.cmd spring-boot:run
```

### Run Tests
```bash
# Unix
./mvnw test

# Windows
.\mvnw.cmd test
```

### Build JAR Package
```bash
# Unix
./mvnw clean package

# Windows
.\mvnw.cmd clean package
```

### Build & Run with Docker
```bash
# Build Docker image
docker build -t narrativex-backend-service .

# Run container
docker run -p 8080:8080 narrativex-backend-service
```

## Application Boundaries
- **Must Own**: Domain models, business rule validation, project state, database schema and migrations (Flyway), client API endpoints, job dispatching, authorization.
- **Must NOT Own**: Direct GPU/media processing, FFmpeg video rendering execution, direct interaction with heavy Python AI inference libraries (delegated asynchronously to `ai-worker`), browser UI rendering (owned by `frontend-web`).
