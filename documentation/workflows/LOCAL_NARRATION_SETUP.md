# Machine-local real narration setup

The machine-local Docker runtime uses the `prod` Spring profile and real provider
semantics. It does not use the developer identity fallback or demo entitlement data.

The real compose runtime uses `TTS_PROVIDER_MODE=vieneu` and
`MEDIA_STORAGE_MODE=r2`. Set `VIENEU_REFERENCE_AUDIO_FILE` to a consented WAV
reference on the host and configure the R2 credentials before starting.

After changing configuration or migrations, rebuild the backend and narration worker:

```powershell
docker compose --env-file .env.prod -f docker-compose.real.yml up -d --build backend narration-worker
```

Check the worker logs for `Narration worker configuration verified` and retry the
narration request. A production worker rejects fake, disabled and local narration
configuration at startup.
