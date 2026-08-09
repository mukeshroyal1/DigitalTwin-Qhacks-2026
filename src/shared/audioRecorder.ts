export type AudioRecorder = {
  stop: () => Promise<Blob>;
  cancel: () => void;
};

function pickMimeType(): string | undefined {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return undefined;
}

export async function startAudioRecording(): Promise<AudioRecorder> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone is not available in this context');
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickMimeType();
  const recorder = mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream);

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  let settle: ((blob: Blob) => void) | null = null;
  let rejectStop: ((err: Error) => void) | null = null;

  recorder.onstop = () => {
    stream.getTracks().forEach((t) => t.stop());
    const type = recorder.mimeType || mimeType || 'audio/webm';
    settle?.(new Blob(chunks, { type }));
  };

  recorder.onerror = () => {
    stream.getTracks().forEach((t) => t.stop());
    rejectStop?.(new Error('Recording failed'));
  };

  recorder.start(250);

  return {
    stop: () =>
      new Promise<Blob>((resolve, reject) => {
        if (recorder.state === 'inactive') {
          resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
          return;
        }
        settle = resolve;
        rejectStop = reject;
        recorder.stop();
      }),
    cancel: () => {
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch {
        // ignore
      }
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}
