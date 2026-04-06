/**
 * hooks/useVoiceRecorder.ts — Voice Recording Hook
 *
 * A React hook that manages microphone access and audio recording
 * using the browser's MediaRecorder API.
 *
 * Automatically negotiates the best supported audio format across browsers:
 *   - Chrome/Edge: prefers audio/webm;codecs=opus
 *   - Firefox: falls back to audio/webm
 *   - Safari/iOS: falls back to audio/mp4 or audio/aac
 *
 * Recording is chunked every 100ms so audio data streams in continuously
 * rather than buffering the entire recording until stop is called.
 *
 * States: "idle" → "recording" → "stopped"
 *
 * Not currently active in VentureLog's UI but fully implemented and
 * ready for a future voice input feature in the AI Coach.
 */
import { useRef, useCallback, useState } from "react";

export type RecordingState = "idle" | "recording" | "stopped";

const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
];

function getSupportedMimeType(): string | undefined {
  for (const mimeType of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }
  return undefined;
}

export function useVoiceRecorder() {
  const [state, setState] = useState<RecordingState>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string | undefined>(undefined);

  const startRecording = useCallback(async (): Promise<void> => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = getSupportedMimeType();
    mimeTypeRef.current = mimeType;

    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    mediaRecorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.start(100);
    setState("recording");
  }, []);

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state !== "recording") {
        resolve(new Blob());
        return;
      }

      recorder.onstop = () => {
        const blobType = mimeTypeRef.current ?? recorder.mimeType ?? "audio/webm";
        const blob = new Blob(chunksRef.current, { type: blobType });
        recorder.stream.getTracks().forEach((t) => t.stop());
        setState("stopped");
        resolve(blob);
      };

      recorder.stop();
    });
  }, []);

  return { state, startRecording, stopRecording };
}
