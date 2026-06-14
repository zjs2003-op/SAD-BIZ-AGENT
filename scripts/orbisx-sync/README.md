# OrbisX calendar sync

Imports OrbisX appointments into `business_memory` (max **5 per run**).

## Setup

Add to `.env.local` and **Vercel environment variables**:

```
ORBISX_API_KEY=your-key
ORBISX_API_BASE=https://orbisx.ca
ORBISX_EVENTS_PATH=/api/v1/events
ORBISX_AUTH_STYLE=bearer
```

If sync fails with 401/404, check OrbisX admin for the correct API base URL and events path, then update those env vars. Try `ORBISX_AUTH_STYLE=api-key` if bearer does not work.

## Manual sync (local dev)

```bash
npm run dev
curl -X POST http://localhost:3000/api/orbisx/sync
```

## Manual sync (production)

```bash
curl -X POST https://sad-biz-agent.vercel.app/api/orbisx/sync
```

Or:

```bash
python3 scripts/orbisx-sync/sync.py
```

## Zapier / webhook fallback

If the REST API path is wrong, POST event JSON directly:

```bash
curl -X PUT https://sad-biz-agent.vercel.app/api/orbisx/sync \
  -H "Content-Type: application/json" \
  -d '{"id":"123","title":"Ceramic Coating","client_name":"John Smith","event_date":"2026-06-15","event_time":"10:00"}'
```

Zapier: OrbisX **New Events Hook** → Webhooks POST/PUT to `/api/orbisx/sync`

## Notes created

| Field | Example |
|-------|---------|
| Title | `OrbisX: John Smith - Ceramic Coating` |
| Tags | `orbisx`, `calendar` |
| Content | event_id, client, date, time, service, etc. |

Duplicates are skipped by `event_id` in note content.
