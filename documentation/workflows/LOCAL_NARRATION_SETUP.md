# Local narration setup

The local demo account is assigned to `PRO` entitlement version `1`. The local
Flyway migration `V4__enable_local_narration.sql` enables the `narration` feature
flag for that seeded plan without changing production entitlement data.

The local `.env` uses `TTS_PROVIDER_MODE=vieneu` and `MEDIA_STORAGE_MODE=r2`.
VieNeu can use the READY user-uploaded MP3 reference per narration request, so a
static `VIENEU_REFERENCE_AUDIO_PATH` is optional for this flow.

After changing local configuration or migrations, rebuild the backend and worker:

```powershell
docker compose up -d --build backend ai-worker
```

Check the worker logs for `Narration worker configuration verified` and retry the
narration request. Do not apply this local entitlement migration to production.
