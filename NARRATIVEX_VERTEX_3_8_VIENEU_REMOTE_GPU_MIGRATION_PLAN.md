# NarrativeX — Plan triển khai Vertex Gemini 3.8 + VieNeu + Remote RTX 3090

## 1. Mục tiêu

Refactor NarrativeX theo kiến trúc sau:

```text
LOCAL PC
├─ Electron / React
├─ Spring Boot
├─ PostgreSQL
├─ ProjectStorage
├─ Final FFmpeg render
└─ Chapter Analyze
      └─ Vertex AI
           └─ Gemini 3.8 Flash
                └─ thinking = HIGH

REMOTE RTX 3090
└─ generation-service
   ├─ VieNeu TTS
   ├─ WhisperX alignment
   ├─ ComfyUI image generation
   └─ media validation
```

Scope hiện tại:

- Dùng Vertex AI + Gemini 3.8 Flash HIGH cho Chapter Analyze.
- Không dùng Qwen cho production Chapter Analyze.
- Bỏ VoiceStudio hoàn toàn khỏi production path.
- Khôi phục VieNeu dưới dạng executor/service độc lập.
- RTX 3090 thuê chỉ chạy workload media nặng:
  - VieNeu
  - WhisperX
  - ComfyUI image generation
  - media validation khi phù hợp
- Chưa triển khai `video.generate`, Wan hoặc pipeline video generation.
- Final render vẫn do Electron + FFmpeg local đảm nhiệm ở phase này.
- Giữ Spring Boot là control plane duy nhất.
- Giữ `generation-service` domain-agnostic, không truy cập PostgreSQL.

(See full plan details in conversation and architecture records)
