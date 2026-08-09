export const OPENAI_PROXY_BASE = 'https://my-extension-xi.vercel.app/api';

export const WHISPER_TRANSCRIPTIONS_URL = `${OPENAI_PROXY_BASE}/audio/transcriptions`;

export async function transcribeAudio(
  blob: Blob,
  opts?: { language?: string; prompt?: string }
): Promise<string> {
  const form = new FormData();
  const ext = blob.type.includes('mp4') || blob.type.includes('m4a') ? 'mp4' : 'webm';
  form.append('file', blob, `recording.${ext}`);
  form.append('model', 'whisper-1');
  if (opts?.language) form.append('language', opts.language);
  if (opts?.prompt) form.append('prompt', opts.prompt);

  const res = await fetch(WHISPER_TRANSCRIPTIONS_URL, {
    method: 'POST',
    // Intentionally no Authorization — proxy injects the real key.
    body: form,
  });

  const data = (await res.json().catch(() => null)) as
    | { text?: string; error?: string; details?: unknown }
    | null;

  if (!res.ok) {
    const detail =
      typeof data?.error === 'string'
        ? data.error
        : data?.details
          ? JSON.stringify(data.details)
          : res.statusText;
    throw new Error(`Transcription failed (${res.status}): ${detail}`);
  }

  const text = typeof data?.text === 'string' ? data.text.trim() : '';
  if (!text) throw new Error('Transcription returned empty text');
  return text;
}
