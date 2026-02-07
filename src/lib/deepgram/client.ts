/**
 * Deepgram streaming client.
 * See docs/integrations/02-DEEPGRAM.md for full integration guide.
 *
 * Usage: Create connection, send audio via connection.send(), receive transcripts via handler.
 * For WebSocket proxy: client streams mic → server → Deepgram; server emits to handler.
 */
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';

export type TranscriptHandler = (params: {
  speaker: number;
  transcript: string;
  isFinal: boolean;
}) => void;

export function createDeepgramLiveConnection(handler: TranscriptHandler) {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPGRAM_API_KEY is required');
  }

  const deepgram = createClient(apiKey);
  const connection = deepgram.listen.live({
    model: 'nova-2',
    language: 'en',
    smart_format: true,
    diarize: true,
    interim_results: true,
  });

  connection.on(LiveTranscriptionEvents.Transcript, (data: { channel?: { alternatives?: Array<{ transcript?: string; words?: Array<{ speaker?: number }> }> }; is_final?: boolean }) => {
    const transcript = data.channel?.alternatives?.[0]?.transcript;
    const speaker = data.channel?.alternatives?.[0]?.words?.[0]?.speaker ?? 0;
    if (transcript) {
      handler({
        speaker,
        transcript,
        isFinal: data.is_final ?? false,
      });
    }
  });

  return connection;
}
