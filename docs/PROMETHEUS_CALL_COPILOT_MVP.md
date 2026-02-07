# Prometheus Call Copilot MVP — Build Spec (for Cursor)

## 1. Goal

Build a real-time AI copilot that supports a human sales/loan agent during scheduled outbound calls. The copilot listens to the call (via live transcription), retrieves product rules from internal manuals, and provides:

- Real-time suggested questions to qualify the lead
- Real-time answers to lead product questions (grounded in manuals)
- A checklist ensuring all required quote inputs are collected
- End-of-call summary ready to paste into HubSpot (Phase 1), then push via API (Phase 2)

**The AI does not speak to the lead in MVP.** It is an agent-facing sidebar.

---

## 2. MVP Scope (Must-Haves)

### Core features

- Live transcript stream (Agent + Lead speakers)
- Product/manual knowledge retrieval (RAG)
- Product quote requirement checklist tracking
- "Next best questions" suggestions updated during call
- "Answer from manual" suggestions when lead asks product questions
- End-of-call summary + extracted fields + missing fields
- Simple web dashboard UI

### Non-goals for MVP

- AI speaking on the call
- Automatic underwriting decisions
- Binding term quotes or commitments
- Full HubSpot telephony integration (Phase 2)

---

## 3. Users & Workflow

### Users

- **Human Agents** (Sales/Loan Agent)
- **Admin** (uploads manuals, edits product requirements)

### Call Workflow

1. Agent opens Copilot web app and selects:
   - Call type / Product (or "Auto-detect")
   - Lead identifier (optional in MVP)
2. Agent starts copilot session
3. Copilot streams transcript live
4. Copilot continuously:
   - Determines relevant product context
   - Retrieves manual snippets
   - Suggests next questions
   - Updates checklist completion status
   - Provides short grounded answers to lead questions
5. Agent ends session
6. Copilot generates:
   - Summary
   - Collected quote fields
   - Missing fields
   - Recommended next steps
7. Agent copies summary to HubSpot (MVP)

---

## 4. Recommended Stack (MVP)

| Layer | Technology |
|-------|------------|
| **Primary language** | TypeScript |
| **Frontend** | Next.js (React), Tailwind CSS (optional), WebSocket or SSE for real-time updates |
| **Backend** | Next.js API routes (or separate Node server) |
| **AI** | OpenAI API (LLM + embeddings) |
| **Vector DB** | Supabase Postgres + pgvector |
| **Transcription** | Deepgram (streaming + diarization) |
| **Hosting** | Vercel for Next.js, Supabase managed DB |
| **Optional Phase 2** | Redis for session state |

---

## 5. External Services Used

| Service | Purpose |
|---------|---------|
| **OpenAI API** | Chat completion (copilot), Embeddings (manual indexing) |
| **Deepgram** | Live streaming speech-to-text with diarization |
| **Supabase** | Database, pgvector similarity search, File storage (optional for raw PDFs) |
| **Phase 2: HubSpot API** | Create/update notes on Contacts/Deals, attach call summary automatically |

---

## 6. Data & Content Requirements

### Products

Prometheus has fewer than 5 products. Each product includes:

- A manual (5–10 pages)
- A list of required quote fields
- Common lead FAQs
- Required product configuration format (JSON)

Store as `/data/products/<product>.json`:

```json
{
  "product_id": "ground_up_construction",
  "product_name": "Ground Up Construction",
  "eligibility": {
    "states_allowed": ["FL", "GA", "TX"],
    "notes": "Example eligibility notes"
  },
  "required_fields": [
    { "key": "property_state", "label": "Property State", "question": "What state is the property in?" },
    { "key": "fico", "label": "FICO", "question": "What's your approximate FICO score?" },
    { "key": "experience_projects", "label": "Experience", "question": "How many ground-up projects have you completed?" },
    { "key": "project_cost", "label": "Project Cost", "question": "What is the total project cost (land + construction)?" },
    { "key": "arv", "label": "ARV", "question": "What is the estimated after-repair value (ARV)?" },
    { "key": "loan_amount", "label": "Loan Amount", "question": "How much are you looking to borrow?" },
    { "key": "exit_strategy", "label": "Exit Strategy", "question": "Is your plan to sell or refinance?" }
  ],
  "common_objections": [
    { "topic": "leverage", "suggested_clarifiers": ["experience_projects", "fico", "arv", "project_cost"] }
  ]
}
```

---

## 7. Manual Ingestion (RAG)

### Goal

Enable AI to answer questions only using approved manual content.

### Steps

1. Convert PDF/manual to text
2. Chunk into sections (target 300–800 tokens per chunk)
3. Create embedding per chunk
4. Store in vector DB with metadata

### Supabase table schema

**`manual_chunks`**

| Column | Type |
|--------|------|
| id | uuid |
| product_id | text |
| chunk_title | text (nullable) |
| chunk_text | text |
| source_ref | text ("manual_name page 4") |
| embedding | vector |
| created_at | timestamp |

### Retrieval

When the copilot needs knowledge:

1. Similarity search for `top_k=5–8` relevant chunks
2. Filter by `product_id` if known

---

## 8. Real-time Transcription

### Requirements

- Streaming STT
- Speaker diarization
- Low latency (updates every ~1–3 seconds)

### Deepgram approach

1. Client streams microphone audio to server
2. Server streams audio to Deepgram
3. Deepgram returns transcript events:
   - speaker id
   - text
   - timestamps
4. Server appends transcript to session state

### Speaker mapping

**MVP acceptable approach:**  
"Speaker 0" assumed Lead, "Speaker 1" Agent (toggle in UI if wrong)

**Phase 2:** Speaker identification + calibration phrase

---

## 9. Copilot Brain Loop

### Session state tracked

- transcript buffer (last 2–5 minutes + full transcript stored)
- selected `product_id` OR "auto-detect"
- extracted fields dictionary
- checklist completion status
- last AI suggestions (to reduce repetition)

### Update cadence

Run copilot loop:

- every 3–5 seconds **OR**
- on transcript change threshold (e.g., 1–2 new utterances)

### Inputs to LLM

- recent transcript window (last 60–120 seconds)
- product JSON (requirements)
- extracted fields so far
- retrieved manual chunks (top 5–8)
- instruction: return strict JSON

### Outputs (strict JSON)

| Field | Description |
|-------|-------------|
| `suggested_questions` | array of 1–3 questions to ask next |
| `detected_product_id` | optional if auto-detect |
| `extracted_fields_updates` | key/value pairs |
| `missing_required_fields` | list |
| `answer_suggestions` | short answers grounded in manual (if lead asked) |
| `agent_actions` | warnings or reminders |

### Example output

```json
{
  "detected_product_id": "ground_up_construction",
  "suggested_questions": [
    { "field": "experience_projects", "question": "How many ground-up projects have you completed?" },
    { "field": "project_cost", "question": "What is the total project cost (land + construction)?" }
  ],
  "extracted_fields_updates": {
    "property_state": "FL"
  },
  "missing_required_fields": ["fico", "experience_projects", "project_cost", "arv", "loan_amount", "exit_strategy"],
  "answer_suggestions": [
    {
      "topic": "leverage",
      "answer": "Leverage depends on experience, FICO, and the deal numbers (ARV and project cost). If you share those, I can confirm the likely LTV range based on our program rules.",
      "citations": ["manual:ground_up_construction p2 chunk:ltv_rules"]
    }
  ],
  "agent_actions": [
    { "type": "warning", "message": "Confirm Florida is eligible for this program per manual eligibility section." }
  ]
}
```

---

## 10. Prompting Requirements (Guardrails)

### Grounding rule

The copilot must only answer product policy questions using retrieved manual text.  
If manual text doesn't contain the answer, the copilot must respond:

> "I don't see that in the manual excerpts. Ask clarifying questions or check the policy."

### Safety / compliance rule

- Do not provide binding commitments, approval, or final pricing.
- Provide ranges/conditions only if the manual explicitly states them.

### JSON-only output rule

The model must return valid JSON (no markdown, no commentary).

---

## 11. API Endpoints (MVP)

### Auth (optional MVP)

- `POST /api/auth/*` — MVP can use simple password gate or no auth for internal testing.

### Manual ingestion

| Method | Endpoint | Input | Output |
|--------|----------|-------|--------|
| POST | `/api/manual/upload` | product_id, manual_text (or file) | count chunks created |
| POST | `/api/manual/search` | product_id (optional), query | top chunks |

### Call session

| Method | Endpoint | Input | Output |
|--------|----------|-------|--------|
| POST | `/api/session/start` | — | session_id |
| POST | `/api/session/ingestTranscript` | session_id, speaker, text, timestamp | — |
| GET | `/api/session/state?session_id=...` | — | transcript + suggestions + checklist |
| POST | `/api/session/end` | — | final summary JSON |

### Copilot loop

| Method | Endpoint | Input | Output |
|--------|----------|-------|--------|
| POST | `/api/copilot/update` | session_id | updated suggestions JSON |

**Implementation note:** Copilot update can run server-side on interval or triggered by transcript ingestion.

---

## 12. UI Requirements (Agent Dashboard)

### Page layout

**Left panel:**

- Live transcript (scrolling)
- Speaker labels (Lead/Agent)
- Toggle to swap speaker mapping

**Right panel:**

- "Suggested Next Questions" (1–3)
- "Manual Answer Suggestions" (when relevant)
- Checklist:
  - ✅ completed fields
  - ⚠️ missing fields
- "End Call" button
- "Copy Summary" button

### Admin page (optional MVP)

- Upload manuals
- Edit product JSON templates

---

## 13. End-of-Call Output (MVP)

Generate a structured object:

```json
{
  "product_id": "ground_up_construction",
  "lead_summary": "Short summary of deal + borrower.",
  "collected_fields": {
    "property_state": "FL",
    "loan_amount": "$500k"
  },
  "missing_fields": ["fico", "arv", "project_cost", "experience_projects", "exit_strategy"],
  "recommended_next_steps": [
    "Follow up to obtain ARV and project cost.",
    "Confirm borrower experience level for leverage determination."
  ]
}
```

UI also renders this into a clean text block for HubSpot notes.

---

## 14. MVP Milestones (Definition of Done)

| # | Milestone | Definition of Done |
|---|-----------|--------------------|
| 1 | Manuals searchable | Upload manual → chunk+embed → vector search works. Query returns correct manual excerpts. |
| 2 | Live transcription | Transcript appears in UI within 1–3 seconds. Speaker separation works well enough (even if manual toggle). |
| 3 | Copilot suggestions | Copilot suggests relevant next questions. Copilot updates checklist as fields get answered. |
| 4 | Product Q&A grounded in manuals | Lead asks question → AI suggests answer using manual excerpts. If not found → says it cannot confirm. |
| 5 | End-of-call output | Generates summary + extracted fields + missing fields. Agent can copy/paste to HubSpot. |

---

## 15. Phase 2 Enhancements (Not MVP)

- **HubSpot integration:** identify contact/deal by phone/email, attach notes automatically, create tasks for missing fields
- **Auto product detection** improvements
- **Better speaker labeling** / calibration
- **Agent typed inputs** to correct fields live
- **Analytics dashboard** (conversion, common missing fields)
- **Permissions, audit logs, manual versioning**

---

## 16. Implementation Notes (Important)

- Store transcript safely (PII considerations)
- Provide "manual citation references" internally (chunk ids) for traceability
- Keep AI responses short and agent-friendly
- Avoid repeated suggestions: track last suggested question IDs
- Use a small transcript window for speed, but store full transcript for summary

---

## 17. Cursor Instructions (what Cursor should generate)

Cursor should implement:

- Next.js app (TypeScript)
- Supabase schema + vector search functions
- Manual ingestion pipeline (chunk/embed/store)
- Deepgram streaming integration
- Session state management
- Copilot update loop using OpenAI
- Agent dashboard UI
- Summary generator
