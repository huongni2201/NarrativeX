# Stage 1: Build application
FROM eclipse-temurin:25-jdk-alpine AS builder
WORKDIR /workspace

# Copy Maven wrapper and POM
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN sed -i 's/\r$//' mvnw && sh ./mvnw dependency:go-offline -B

# Copy source code and build package
COPY src ./src
RUN sh ./mvnw clean package -Dmaven.test.skip=true -B

# Stage 2: Production runtime
FROM eclipse-temurin:25-jre-alpine AS runner
WORKDIR /app

# Used by the container healthcheck against Spring Boot Actuator.
RUN apk add --no-cache wget

# Run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Copy JAR from builder
COPY --from=builder --chown=appuser:appgroup /workspace/target/*.jar app.jar

ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=10 \
  CMD wget -q -O - http://127.0.0.1:8080/actuator/health >/dev/null || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
