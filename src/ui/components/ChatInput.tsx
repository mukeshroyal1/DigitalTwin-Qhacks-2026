import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { startAudioRecording, type AudioRecorder } from '../../shared/audioRecorder';
import { transcribeAudio } from '../../shared/openaiProxy';

type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: (text?: string) => void;
  onCancel: () => void;
  disabled?: boolean;
  isSending?: boolean;
};

export function ChatInput({
  value,
  onChange,
  onSend,
  onCancel,
  disabled,
  isSending,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const listeningRef = useRef(false);
  const baseTextRef = useRef('');
  const valueRef = useRef(value);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [micSupported] = useState(
    () => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
  );

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  useEffect(() => {
    return () => {
      listeningRef.current = false;
      recorderRef.current?.cancel();
      recorderRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (isSending && listeningRef.current) {
      listeningRef.current = false;
      setListening(false);
      recorderRef.current?.cancel();
      recorderRef.current = null;
    }
  }, [isSending]);

  const finishRecording = async (andSend: boolean) => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    listeningRef.current = false;
    setListening(false);
    if (!recorder) return;

    setMicError(null);
    setTranscribing(true);
    try {
      const blob = await recorder.stop();
      if (!blob.size) {
        throw new Error('No audio captured');
      }
      const transcript = await transcribeAudio(blob);
      const base = baseTextRef.current;
      const text = `${base}${transcript}`.trim();
      onChange(text);
      if (andSend && text) onSend(text);
    } catch (error) {
      setMicError(error instanceof Error ? error.message : 'Transcription failed');
    } finally {
      setTranscribing(false);
    }
  };

  const startListening = async () => {
    if (isSending || transcribing) return;
    setMicError(null);
    try {
      const recorder = await startAudioRecording();
      recorderRef.current = recorder;
      baseTextRef.current = valueRef.current.trim() ? `${valueRef.current.trim()} ` : '';
      listeningRef.current = true;
      setListening(true);
    } catch (error) {
      setMicError(
        error instanceof Error ? error.message : 'Could not access the microphone'
      );
    }
  };

  const toggleMic = () => {
    if (isSending || transcribing) return;
    if (listeningRef.current) {
      void finishRecording(true);
      return;
    }
    void startListening();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (listeningRef.current) {
        void finishRecording(true);
        return;
      }
      if (!disabled && !transcribing && value.trim()) onSend();
    }
  };

  const busy = Boolean(isSending || transcribing);
  const placeholder = listening
    ? 'Listening… click mic again to send'
    : transcribing
      ? 'Transcribing…'
      : undefined;

  return (
    <div className="composer">
      <div className="input-container">
        <div
          className={`input-wrapper ${listening ? 'listening' : ''} ${
            transcribing ? 'transcribing' : ''
          }`}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={busy}
          />
          {micError && <div className="mic-error">{micError}</div>}
          <div className="input-bottom">
            {micSupported && !isSending && (
              <button
                className={`mic-btn ${listening ? 'active' : ''} ${
                  transcribing ? 'transcribing' : ''
                }`}
                type="button"
                onClick={toggleMic}
                disabled={transcribing}
                title={
                  listening
                    ? 'Stop and send'
                    : transcribing
                      ? 'Transcribing…'
                      : 'Voice input (Whisper)'
                }
                aria-pressed={listening}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </button>
            )}
            {isSending ? (
              <button
                className="send-btn stop-btn"
                type="button"
                onClick={onCancel}
                title="Stop"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  stroke="none"
                >
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
              </button>
            ) : (
              <button
                className="send-btn"
                type="button"
                onClick={() => {
                  if (listeningRef.current) {
                    void finishRecording(true);
                    return;
                  }
                  onSend();
                }}
                disabled={disabled || transcribing || (!value.trim() && !listening)}
                title="Send message"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
