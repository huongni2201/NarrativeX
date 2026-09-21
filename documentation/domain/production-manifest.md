# Video-First Production Manifest Contract

**Status:** Authoritative Manifest Specification  
**Date:** 2026-09-20  

---

## 1. Overview

The `ProductionManifest` represents the immutable record of a completed or in-progress video-first production run. It captures shot tallies, strategy breakdowns, take efficiency, model execution details, and output parameters.

---

## 2. Schema Specification

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://narrativex.local/contracts/production-manifest.v1.schema.json",
  "title": "VideoFirstProductionManifest",
  "type": "object",
  "required": [
    "schemaVersion",
    "projectId",
    "storyVersionId",
    "chapterId",
    "architectureVersion",
    "shots",
    "generation",
    "takes",
    "retry",
    "output"
  ],
  "properties": {
    "schemaVersion": { "const": "1.0" },
    "projectId": { "type": "string", "format": "uuid" },
    "storyVersionId": { "type": "string", "format": "uuid" },
    "chapterId": { "type": "string", "format": "uuid" },
    "architectureVersion": { "const": "video-first-v1" },
    "shots": {
      "type": "object",
      "required": ["total", "t2v", "i2v", "firstLastFrame", "multiKeyframe", "extend", "retake"],
      "properties": {
        "total": { "type": "integer", "minimum": 1 },
        "t2v": { "type": "integer", "minimum": 0 },
        "i2v": { "type": "integer", "minimum": 0 },
        "firstLastFrame": { "type": "integer", "minimum": 0 },
        "multiKeyframe": { "type": "integer", "minimum": 0 },
        "extend": { "type": "integer", "minimum": 0 },
        "retake": { "type": "integer", "minimum": 0 }
      }
    },
    "generation": {
      "type": "object",
      "required": ["provider", "model"],
      "properties": {
        "provider": { "type": "string" },
        "model": { "type": "string" }
      }
    },
    "takes": {
      "type": "object",
      "required": ["total", "passed", "failed"],
      "properties": {
        "total": { "type": "integer", "minimum": 1 },
        "passed": { "type": "integer", "minimum": 0 },
        "failed": { "type": "integer", "minimum": 0 }
      }
    },
    "retry": {
      "type": "object",
      "required": ["count"],
      "properties": {
        "count": { "type": "integer", "minimum": 0 }
      }
    },
    "output": {
      "type": "object",
      "required": ["resolution", "fps", "totalDurationMs"],
      "properties": {
        "resolution": { "type": "string", "enum": ["1280x720", "1920x1080"] },
        "fps": { "type": "integer", "enum": [24, 30] },
        "totalDurationMs": { "type": "integer", "minimum": 1 }
      }
    }
  }
}
```
