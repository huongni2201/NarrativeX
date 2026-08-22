# Browser upload CORS for Cloudflare R2

NarrativeX creates short-lived presigned R2 `PUT` URLs for browser uploads. The
R2 bucket must therefore allow the frontend origin and every request header sent
with the presigned upload. This is separate from Spring's API CORS policy.

For local development, apply this policy to the `narrativex-dev` bucket in the
Cloudflare R2 dashboard under **Settings → CORS Policy**:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://127.0.0.1:3000"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type", "x-amz-checksum-sha256"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

The origins must match the browser origin exactly and must not include a path or
trailing slash. Add the deployed frontend origin as a separate rule or origin
before using the production bucket; do not use `*` for a private upload bucket.

After saving the policy, allow up to 30 seconds for propagation, then retry the
upload with a newly generated upload intent. An old presigned URL should not be
reused after configuration changes.

After changing backend source or `.env`, rebuild the backend container so it uses
the current R2 endpoint and metadata verification code:

```powershell
docker compose up -d --build backend
```

The finalize request should return HTTP 200 with `status: "VALIDATING"`; the
durable validator later moves the canonical asset to `READY`. If it still returns
HTTP 400, search the backend log using the response `correlationId`; the
API logs the exception type and message for this boundary so a storage parsing
error is not mistaken for a malformed client request.

For Wrangler, use its `rules` format instead of the dashboard format above:

```json
{
  "rules": [
    {
      "allowed": {
        "origins": ["http://localhost:3000", "http://127.0.0.1:3000"],
        "methods": ["PUT"],
        "headers": ["Content-Type", "x-amz-checksum-sha256"]
      },
      "exposeHeaders": ["ETag"],
      "maxAgeSeconds": 3600
    }
  ]
}
```

```powershell
npx wrangler r2 bucket cors set narrativex-dev --file .\r2-cors.json
npx wrangler r2 bucket cors list narrativex-dev
```
