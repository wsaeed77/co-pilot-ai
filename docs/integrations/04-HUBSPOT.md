# HubSpot API Integration (Phase 2)

## Overview

**Phase 2 only.** HubSpot integration enables:

- Identify contact/deal by phone or email
- Attach call summary as a note on Contact or Deal
- Create tasks for missing fields
- Optional: sync call metadata to custom properties

MVP uses manual copy/paste; Phase 2 automates via API.

---

## Prerequisites

- HubSpot account
- Private app or OAuth app with scopes:
  - `crm.objects.contacts.read`, `crm.objects.contacts.write`
  - `crm.objects.deals.read`, `crm.objects.deals.write`
  - `crm.objects.companies.read` (optional)
  - `timeline` (for engagement/notes)

---

## Environment Variables (Phase 2)

```env
HUBSPOT_ACCESS_TOKEN=pat-...   # Private app token or OAuth access token
HUBSPOT_PORTAL_ID=12345678    # Optional, for tracking
```

---

## Key Endpoints

| Action | Method | Endpoint |
|--------|--------|----------|
| Search contact by email | POST | `/crm/v3/objects/contacts/search` |
| Search contact by phone | POST | `/crm/v3/objects/contacts/search` |
| Get contact | GET | `/crm/v3/objects/contacts/{id}` |
| Create note (engagement) | POST | `/crm/v3/objects/notes` |
| Associate note to contact | PUT | `/crm/v3/objects/notes/{id}/associations/contacts/{contactId}` |
| Create task | POST | `/crm/v3/objects/tasks` |
| Associate task to contact | PUT | `/crm/v3/objects/tasks/{id}/associations/contacts/{contactId}` |

base URL: `https://api.hubapi.com`

---

## 1. Identify Contact

### Search by Email

```typescript
const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    filterGroups: [{
      filters: [{
        propertyName: 'email',
        operator: 'EQ',
        value: leadEmail,
      }],
    }],
    properties: ['email', 'firstname', 'lastname', 'phone'],
  }),
});
const { results } = await response.json();
const contactId = results[0]?.id;
```

### Search by Phone

```typescript
// Phone may be in 'phone' or custom property
filterGroups: [{
  filters: [{
    propertyName: 'phone',
    operator: 'EQ',
    value: normalizedPhone,
  }],
}],
```

---

## 2. Create Note (Call Summary)

```typescript
const noteResponse = await fetch('https://api.hubapi.com/crm/v3/objects/notes', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    properties: {
      hs_timestamp: new Date().toISOString(),
      hs_note_body: formatSummaryForHubSpot(callSummary),
      hs_next_step: callSummary.recommended_next_steps?.[0] || '',
    },
  }),
});
const { id: noteId } = await noteResponse.json();

// Associate to contact
await fetch(`https://api.hubapi.com/crm/v3/objects/notes/${noteId}/associations/contacts/${contactId}/note_to_contact`, {
  method: 'PUT',
  headers: {
    Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify([]),
});
```

### Summary Format for HubSpot

```typescript
function formatSummaryForHubSpot(summary: CallSummary): string {
  return `
## Call Summary – ${summary.product_id}

**Lead:** ${summary.lead_summary}

**Collected:**
${Object.entries(summary.collected_fields).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

**Missing:** ${summary.missing_fields.join(', ')}

**Next Steps:**
${summary.recommended_next_steps.map(s => `- ${s}`).join('\n')}
  `.trim();
}
```

---

## 3. Create Tasks (Missing Fields)

```typescript
for (const field of summary.missing_fields) {
  await fetch('https://api.hubapi.com/crm/v3/objects/tasks', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        hs_timestamp: new Date().toISOString(),
        hs_task_subject: `Follow up: ${field}`,
        hs_task_body: `Obtain ${field} for quote completion.`,
        hs_task_status: 'NOT_STARTED',
        hs_task_priority: 'MEDIUM',
      },
    }),
  }).then(async (res) => {
    const { id } = await res.json();
    await associateTaskToContact(id, contactId);
  });
}
```

---

## 4. Deal Association (Optional)

If call is tied to a Deal:

```typescript
await fetch(`https://api.hubapi.com/crm/v3/objects/notes/${noteId}/associations/deals/${dealId}/note_to_deal`, {
  method: 'PUT',
  headers: {
    Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify([]),
});
```

---

## Implementation Locations (Phase 2)

| File | Responsibility |
|------|----------------|
| `lib/hubspot/client.ts` | Base fetch wrapper, auth |
| `lib/hubspot/contacts.ts` | Search contact by email/phone |
| `lib/hubspot/engagements.ts` | Create note, associate to contact/deal |
| `lib/hubspot/tasks.ts` | Create tasks for missing fields |
| `app/api/hubspot/push/route.ts` | POST endpoint: session_id → push to HubSpot |

---

## API Rate Limits

- 100 requests / 10 seconds (varies by tier)
- Implement throttling/queue for bulk operations
- Use batch endpoints where available

---

## Error Handling

- **401:** Invalid or expired token
- **404:** Contact not found → create new contact or return "not found" to agent
- **429:** Rate limit → backoff and retry

---

## MVP Fallback

Until Phase 2, the UI provides a "Copy Summary" button that formats the summary as plain text for manual paste into HubSpot. No API calls.
