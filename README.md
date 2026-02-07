# Prometheus Call Copilot

Real-time AI copilot for sales/loan agents during outbound calls.

## Setup

1. Copy `.env.example` to `.env.local` and fill in:
   - `OPENAI_API_KEY`
   - `DEEPGRAM_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

2. Run Supabase migrations:
   ```bash
   supabase db push
   ```
   Or run `supabase/migrations/001_initial.sql` in the Supabase SQL editor.

3. Install and run:
   ```bash
   npm install
   npm run dev
   ```

4. Open http://localhost:3000

## Pages

- **/** — Home
- **/dashboard** — Agent dashboard (live transcript, suggestions, checklist)
- **/admin** — Admin: upload manuals, search

## Integration Docs

See [docs/integrations/](./docs/integrations/) for:

- [OpenAI](./docs/integrations/01-OPENAI.md)
- [Deepgram](./docs/integrations/02-DEEPGRAM.md)
- [Supabase](./docs/integrations/03-SUPABASE.md)
- [HubSpot (Phase 2)](./docs/integrations/04-HUBSPOT.md)

## MVP Features

- Manual upload → chunk + embed → vector search
- Session start/end, transcript ingestion
- Copilot suggestions (next questions, manual answers, checklist)
- End-of-call summary with copy for HubSpot
- Simulate transcript (no Deepgram yet) for testing
