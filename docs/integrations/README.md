# External Integrations

Integration documentation for the Prometheus Call Copilot MVP.

| # | Service | Doc | MVP | Phase 2 |
|---|---------|-----|-----|--------|
| 1 | [OpenAI](./01-OPENAI.md) | Chat + Embeddings | ✅ | — |
| 2 | [Deepgram](./02-DEEPGRAM.md) | Live transcription | ✅ | — |
| 3 | [Supabase](./03-SUPABASE.md) | DB + pgvector | ✅ | — |
| 4 | [HubSpot](./04-HUBSPOT.md) | Notes, tasks, contacts | 📋 Copy/paste | ✅ API |

---

## Setup Order

1. **Supabase** — Create project, run migrations, get keys
2. **OpenAI** — Create API key
3. **Deepgram** — Create API key
4. **HubSpot** — Phase 2 only; create private app when ready

---

## Environment Template

```env
# OpenAI
OPENAI_API_KEY=sk-...

# Deepgram
DEEPGRAM_API_KEY=...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# HubSpot (Phase 2)
# HUBSPOT_ACCESS_TOKEN=pat-...
```
