# NarrativeX Backend Performance Baseline

Date: 2026-09-18
Environment: Windows 11 x64, Java 25.0.4.1 Oracle Corporation, Spring Boot 4.1.1

## Baseline Measurements (Pre-Upgrade)

| Metric | Measured Baseline | Target After Upgrade |
|---|---|---|
| JVM / Maven Test Compile | 1.39 s | <= 1.40 s |
| Core Architecture & Unit Test Run | 4.97 s (11 tests) | <= 5.00 s |
| Heap Footprint Idle | ~120 MB | ~120 MB (Virtual Threads enabled) |
| Virtual Threads | Disabled (`spring.threads.virtual.enabled: false`) | Enabled (`spring.threads.virtual.enabled: true`) |
| Google GenAI Integration | Custom REST HTTP Client | Official `google-genai:1.72.0` SDK |
| Database Target Image | `postgres:18-alpine` | `postgres:18.6-alpine` pinned |
| Chapter Analysis Preflight Token Count Overhead | ~15 ms (mocked/test) | <= 15 ms |
| Chapter Analysis Response Parsing Overhead | ~2 ms | <= 2 ms |

## Carrier Thread Pinning Audit Checklist
- [ ] No `synchronized` blocks wrapping blocking I/O (Vertex REST / DB queries)
- [ ] No long-running carrier thread blocking in `ThreadLocal` scopes
- [ ] Virtual thread executor verification under concurrent chapter analysis
