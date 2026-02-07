import { supabase } from './client';

export interface SessionState {
  id: string;
  product_id: string | null;
  transcript: Array<{ speaker: string; text: string; timestamp: string }>;
  extracted_fields: Record<string, string>;
  copilot_state: Record<string, unknown> | null;
  summary: Record<string, unknown> | null;
  ended_at: string | null;
}

export async function createSession(productId?: string | null, leadIdentifier?: string) {
  const { data, error } = await supabase
    .from('call_sessions')
    .insert({
      product_id: productId ?? null,
      lead_identifier: leadIdentifier ?? null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return { session_id: data.id };
}

export async function getSession(sessionId: string) {
  const { data, error } = await supabase
    .from('call_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error) throw error;
  return data as SessionState;
}

export async function appendTranscript(
  sessionId: string,
  speaker: string,
  text: string,
  timestamp: string
) {
  const session = await getSession(sessionId);
  const transcript = (session.transcript as Array<{ speaker: string; text: string; timestamp: string }>) ?? [];
  transcript.push({ speaker, text, timestamp });

  const { error } = await supabase
    .from('call_sessions')
    .update({ transcript })
    .eq('id', sessionId);

  if (error) throw error;
}

export async function updateSessionState(
  sessionId: string,
  updates: {
    extracted_fields?: Record<string, string>;
    copilot_state?: Record<string, unknown>;
  }
) {
  const { error } = await supabase
    .from('call_sessions')
    .update(updates)
    .eq('id', sessionId);

  if (error) throw error;
}

export async function endSession(sessionId: string, summary: Record<string, unknown>) {
  const { error } = await supabase
    .from('call_sessions')
    .update({ ended_at: new Date().toISOString(), summary })
    .eq('id', sessionId);

  if (error) throw error;
}
