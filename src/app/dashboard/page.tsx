'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface TranscriptUtterance {
  speaker: string;
  text: string;
  timestamp: string;
}

interface SuggestedQuestion {
  field: string;
  question: string;
}

interface AnswerSuggestion {
  topic: string;
  answer: string;
  citations: string[];
}

interface CopilotState {
  suggested_questions: SuggestedQuestion[];
  extracted_fields_updates: Record<string, string>;
  missing_required_fields: string[];
  answer_suggestions?: AnswerSuggestion[];
  agent_actions?: Array<{ type: string; message: string }>;
}

interface CallSummary {
  product_id: string;
  lead_summary: string;
  collected_fields: Record<string, string>;
  missing_fields: string[];
  recommended_next_steps: string[];
}

export default function DashboardPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [productId, setProductId] = useState('ground_up_construction');
  const [transcript, setTranscript] = useState<TranscriptUtterance[]>([]);
  const [extractedFields, setExtractedFields] = useState<Record<string, string>>({});
  const [copilotState, setCopilotState] = useState<CopilotState | null>(null);
  const [summary, setSummary] = useState<CallSummary | null>(null);
  const [swappedSpeakers, setSwappedSpeakers] = useState(false);
  const [recording, setRecording] = useState(false);
  const [summaryCopied, setSummaryCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const startSession = useCallback(async () => {
    const res = await fetch('/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId }),
    });
    const data = await res.json();
    if (data.session_id) {
      setSessionId(data.session_id);
      setTranscript([]);
      setExtractedFields({});
      setCopilotState(null);
      setSummary(null);
    }
  }, [productId]);

  const endSession = useCallback(async () => {
    if (!sessionId) return;
    setRecording(false);
    if (pollRef.current) clearInterval(pollRef.current);
    const res = await fetch('/api/session/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    });
    const data = await res.json();
    setSummary(data);
  }, [sessionId]);

  const ingestTranscript = useCallback(
    async (speaker: string, text: string) => {
      if (!sessionId) return;
      await fetch('/api/session/ingest-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          speaker,
          text,
          timestamp: new Date().toISOString(),
        }),
      });
    },
    [sessionId]
  );

  const runCopilotUpdate = useCallback(async () => {
    if (!sessionId) return;
    const res = await fetch('/api/copilot/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    });
    const data = await res.json();
    setCopilotState(data);
  }, [sessionId]);

  const fetchState = useCallback(async () => {
    if (!sessionId) return;
    const res = await fetch(`/api/session/state?session_id=${sessionId}`);
    const data = await res.json();
    setTranscript(data.transcript ?? []);
    setExtractedFields(data.extracted_fields ?? {});
    if (data.copilot_state) setCopilotState(data.copilot_state);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    fetchState();
    pollRef.current = setInterval(fetchState, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sessionId, fetchState]);

  const simulateTranscript = useCallback(() => {
    const leadSays = [
      "Hi, I'm calling about a ground-up construction loan in Florida.",
      "We're looking to borrow around $500k.",
      "What kind of leverage can you offer?",
      "I've done about 5 ground-up projects.",
      "The total project cost is around $800k.",
    ];
    const agentSays = [
      "Great, I'd be happy to help. What state is the property in?",
      "Got it. What's your approximate FICO score?",
      "Let me check our program rules for that.",
    ];
    let i = 0;
    const add = (speaker: string, text: string) => {
      setTranscript((prev) => [
        ...prev,
        { speaker, text, timestamp: new Date().toISOString() },
      ]);
      ingestTranscript(speaker, text);
    };
    add('1', agentSays[0] ?? '');
    setTimeout(() => add('0', leadSays[0] ?? ''), 1000);
    setTimeout(() => add('0', leadSays[1] ?? ''), 2500);
    setTimeout(() => add('1', agentSays[1] ?? ''), 4000);
    setTimeout(() => add('0', leadSays[2] ?? ''), 5500);
    setTimeout(() => runCopilotUpdate(), 6000);
  }, [ingestTranscript, runCopilotUpdate]);

  const copySummary = useCallback(() => {
    if (!summary) return;
    const text = `
## Call Summary – ${summary.product_id}

**Lead:** ${summary.lead_summary}

**Collected:**
${Object.entries(summary.collected_fields).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

**Missing:** ${summary.missing_fields.join(', ')}

**Next Steps:**
${summary.recommended_next_steps.map((s) => `- ${s}`).join('\n')}
    `.trim();
    navigator.clipboard.writeText(text);
    setSummaryCopied(true);
    setTimeout(() => setSummaryCopied(false), 2000);
  }, [summary]);

  const label = (speaker: string) => {
    const s = speaker === '0' ? '0' : '1';
    if (swappedSpeakers) return s === '0' ? 'Agent' : 'Lead';
    return s === '0' ? 'Lead' : 'Agent';
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-xl font-semibold text-slate-800">
          Prometheus Call Copilot
        </h1>
      </header>

      <main className="flex flex-1 gap-6 p-6">
        {/* Left: Transcript */}
        <div className="flex w-1/2 flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-medium text-slate-700">Live Transcript</h2>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={swappedSpeakers}
                  onChange={(e) => setSwappedSpeakers(e.target.checked)}
                />
                Swap Lead/Agent
              </label>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto rounded border border-slate-100 bg-slate-50/50 p-3 font-mono text-sm">
            {transcript.length === 0 && (
              <p className="text-slate-400">No transcript yet.</p>
            )}
            {transcript.map((u, i) => (
              <div key={i} className="mb-2">
                <span
                  className={
                    label(u.speaker) === 'Lead'
                      ? 'text-amber-600'
                      : 'text-blue-600'
                  }
                >
                  {label(u.speaker)}:
                </span>{' '}
                {u.text}
              </div>
            ))}
          </div>

          {!sessionId && (
            <button
              onClick={startSession}
              className="mt-4 rounded-md bg-slate-800 px-4 py-2 text-white hover:bg-slate-700"
            >
              Start Session
            </button>
          )}
          {sessionId && !summary && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={simulateTranscript}
                className="rounded-md bg-amber-600 px-4 py-2 text-white hover:bg-amber-500"
              >
                Simulate Transcript
              </button>
              <button
                onClick={runCopilotUpdate}
                className="rounded-md bg-slate-600 px-4 py-2 text-white hover:bg-slate-500"
              >
                Update Copilot
              </button>
              <button
                onClick={endSession}
                className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-500"
              >
                End Call
              </button>
            </div>
          )}
        </div>

        {/* Right: Suggestions + Checklist */}
        <div className="flex w-1/2 flex-col gap-4">
          {/* Suggested questions */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-medium text-slate-700">
              Suggested Next Questions
            </h2>
            <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
              {copilotState?.suggested_questions?.length
                ? copilotState.suggested_questions.map((q, i) => (
                    <li key={i}>{q.question}</li>
                  ))
                : '—'}
            </ul>
          </div>

          {/* Manual answers */}
          {copilotState?.answer_suggestions && copilotState.answer_suggestions.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 font-medium text-slate-700">
                Manual Answer Suggestions
              </h2>
              <ul className="space-y-2 text-sm">
                {copilotState.answer_suggestions.map((a, i) => (
                  <li key={i} className="rounded bg-slate-50 p-2">
                    <strong>{a.topic}:</strong> {a.answer}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Checklist */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-medium text-slate-700">Quote Checklist</h2>
            <ul className="space-y-1 text-sm">
              {Object.keys(extractedFields).length > 0 || (copilotState?.missing_required_fields?.length ?? 0) > 0 ? (
                <>
                  {Object.entries(extractedFields).map(([k, v]) => (
                    <li key={k} className="flex items-center gap-2">
                      <span className="text-green-600">✓</span> {k}: {v}
                    </li>
                  ))}
                  {(copilotState?.missing_required_fields ?? []).map((k) => (
                    <li key={k} className="flex items-center gap-2 text-amber-600">
                      <span>⚠</span> {k}
                    </li>
                  ))}
                </>
              ) : (
                <li className="text-slate-400">—</li>
              )}
            </ul>
          </div>

          {/* Summary + Copy */}
          {summary && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
              <h2 className="mb-2 font-medium text-emerald-800">
                End-of-Call Summary
              </h2>
              <pre className="mb-4 max-h-48 overflow-y-auto rounded bg-white p-3 text-xs">
                {JSON.stringify(summary, null, 2)}
              </pre>
              <button
                onClick={copySummary}
                className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500"
              >
                {summaryCopied ? 'Copied!' : 'Copy Summary for HubSpot'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
