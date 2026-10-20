"use client";

/**
 * Voice for the CSA Assistant chat — dictation and a hands-free "voice mode".
 *
 * Uses only the browser's built-in, free Web Speech APIs: SpeechRecognition
 * (Chrome, Edge, Safari) turns the rep's speech into text, and speechSynthesis
 * reads the assistant's replies aloud. Nothing new on the backend: recognised
 * text is sent through the same `sendMessage` as typed text, so every tool,
 * approval card and stepper behaves exactly as it does for typing. Approvals
 * stay clicks — a misheard "yes" must never approve a write.
 *
 *  - Dictation: the mic fills the input box; the rep reviews and sends.
 *  - Voice mode: speech is sent automatically, the reply is spoken sentence by
 *    sentence as it streams, then the mic reopens. The mic is closed while the
 *    assistant speaks so it never transcribes itself.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";

// Minimal Web Speech typings — SpeechRecognition isn't in TypeScript's DOM lib.
interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function getRecognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export type VoicePhase = "off" | "listening" | "thinking" | "speaking" | "paused";

/** Plain text of an assistant message, with markdown removed so it reads naturally. */
function speakableText(message: UIMessage): string {
  const raw = message.parts
    .filter((p): p is { type: "text"; text: string } => (p as { type: string }).type === "text")
    .map((p) => p.text)
    .join(" ");
  return raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[*_~>|]/g, "")
    .replace(/\s+/g, " ");
}

/** Index just past the last complete sentence in `text`, or 0 if none yet. */
function lastSentenceEnd(text: string): number {
  const re = /[.!?]+["')\]]*\s/g;
  let end = 0;
  while (re.exec(text) !== null) end = re.lastIndex;
  return end;
}

interface Options {
  messages: UIMessage[];
  isLoading: boolean;
  /** Current input box value — dictation appends to it. */
  input: string;
  setInput: (value: string) => void;
  sendText: (text: string) => void;
  lang: string;
}

export function useVoiceChat({ messages, isLoading, input, setInput, sendText, lang }: Options) {
  const [recognitionSupported, setRecognitionSupported] = useState(false);
  const [synthesisSupported, setSynthesisSupported] = useState(false);
  const [dictating, setDictating] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [phase, setPhase] = useState<VoicePhase>("off");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<Recognition | null>(null);
  const queueRef = useRef<string[]>([]);
  const speakingRef = useRef(false);
  const voiceModeRef = useRef(false);
  const awaitingReplyRef = useRef(false);
  const emptyListensRef = useRef(0);
  /** Which assistant message is being read aloud, and how much of it has been queued. */
  const spokenRef = useRef<{ id: string | null; upTo: number }>({ id: null, upTo: 0 });
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;

  useEffect(() => {
    setRecognitionSupported(Boolean(getRecognitionCtor()));
    setSynthesisSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  // ── Recognition ──────────────────────────────────────────────────────────

  const stopRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recognition?.abort();
    setInterim("");
  }, []);

  const startRecognition = useCallback(
    (handlers: { onInterim: (text: string) => void; onFinal: (text: string) => void; onSilence: () => void }) => {
      const Ctor = getRecognitionCtor();
      if (!Ctor || recognitionRef.current) return false;
      const recognition = new Ctor();
      recognition.lang = lang;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      let finalText = "";
      let blocked = false;

      recognition.onresult = (event) => {
        let interimText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) finalText += result[0].transcript;
          else interimText += result[0].transcript;
        }
        handlers.onInterim((finalText + interimText).trim());
      };
      recognition.onerror = (event) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          blocked = true;
          setError("Microphone access is blocked. Allow it in your browser's site settings to use voice.");
        } else if (event.error === "network") {
          blocked = true;
          setError("The browser's speech service isn't reachable right now. You can keep typing.");
        } else if (event.error === "audio-capture") {
          blocked = true;
          setError("No microphone was found.");
        }
      };
      recognition.onend = () => {
        if (recognitionRef.current !== recognition) return; // stopped on purpose
        recognitionRef.current = null;
        setInterim("");
        const text = finalText.trim();
        if (blocked) {
          // No point retrying a blocked/absent mic — leave voice mode.
          voiceModeRef.current = false;
          setVoiceMode(false);
          setPhase("off");
        }
        if (text) handlers.onFinal(text);
        else handlers.onSilence();
      };

      recognitionRef.current = recognition;
      setError(null);
      try {
        recognition.start();
        return true;
      } catch {
        recognitionRef.current = null;
        return false;
      }
    },
    [lang]
  );

  // ── Voice mode listening loop ────────────────────────────────────────────

  const listen = useCallback(() => {
    if (!voiceModeRef.current) return;
    const started = startRecognition({
      onInterim: setInterim,
      onFinal: (text) => {
        emptyListensRef.current = 0;
        awaitingReplyRef.current = true;
        setPhase("thinking");
        sendText(text);
      },
      onSilence: () => {
        if (!voiceModeRef.current) return;
        // The browser stops after a few seconds of silence; keep listening a
        // little longer, then pause until the rep taps to talk.
        if (++emptyListensRef.current < 3) listen();
        else {
          emptyListensRef.current = 0;
          setPhase("paused");
        }
      }
    });
    if (started) setPhase("listening");
  }, [sendText, startRecognition]);

  // ── Speech synthesis ─────────────────────────────────────────────────────

  const afterSpeech = useCallback(() => {
    if (!voiceModeRef.current || speakingRef.current || isLoadingRef.current) return;
    if (!awaitingReplyRef.current) return;
    awaitingReplyRef.current = false;
    listen();
  }, [listen]);

  const speakNext = useCallback(() => {
    const next = queueRef.current.shift();
    if (!next || typeof window === "undefined" || !("speechSynthesis" in window)) {
      speakingRef.current = false;
      if (voiceModeRef.current && isLoadingRef.current) setPhase("thinking");
      afterSpeech();
      return;
    }
    speakingRef.current = true;
    setPhase("speaking");
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(next);
    utterance.lang = lang;
    const voices = synth.getVoices();
    const voice = voices.find((v) => v.lang === lang) ?? voices.find((v) => v.lang.startsWith(lang.slice(0, 2)));
    if (voice) utterance.voice = voice;
    let finished = false;
    const done = () => {
      // onend, onerror and the watchdog can all fire — advance only once.
      if (finished) return;
      finished = true;
      window.clearTimeout(watchdog);
      if (speakingRef.current) speakNext();
    };
    // Some browsers occasionally never fire onend; never let that wedge voice mode.
    const watchdog = window.setTimeout(done, 2000 + next.length * 90);
    utterance.onend = done;
    utterance.onerror = done;
    synth.speak(utterance);
  }, [afterSpeech, lang]);

  const enqueue = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      queueRef.current.push(clean);
      if (!speakingRef.current) speakNext();
    },
    [speakNext]
  );

  const stopSpeaking = useCallback(() => {
    queueRef.current = [];
    speakingRef.current = false;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  /** Marks everything currently on screen as already read, so only new replies are spoken. */
  const markAllSpoken = useCallback(() => {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    spokenRef.current = last ? { id: last.id, upTo: speakableText(last).length } : { id: null, upTo: 0 };
  }, [messages]);

  // Read the latest assistant reply aloud as it streams in.
  useEffect(() => {
    if (!voiceModeRef.current) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    if (spokenRef.current.id !== last.id) spokenRef.current = { id: last.id, upTo: 0 };
    const text = speakableText(last);
    const pending = text.slice(spokenRef.current.upTo);
    const take = isLoading ? lastSentenceEnd(pending) : pending.length;
    if (take > 0) {
      enqueue(pending.slice(0, take));
      spokenRef.current.upTo += take;
    }
  }, [messages, isLoading, enqueue]);

  // A reply started — whether from speech, typing, an approval click or a
  // stepper action. Close the mic so it can't hear the reply being spoken,
  // and plan to listen again once it's done.
  useEffect(() => {
    if (!isLoading || !voiceModeRef.current) return;
    awaitingReplyRef.current = true;
    stopRecognition();
    if (!speakingRef.current) setPhase("thinking");
  }, [isLoading, stopRecognition]);

  // When the reply has finished and nothing is left to say, listen again.
  useEffect(() => {
    if (!isLoading) afterSpeech();
  }, [isLoading, afterSpeech]);

  // ── Public controls ──────────────────────────────────────────────────────

  const toggleDictation = useCallback(() => {
    if (dictating) {
      stopRecognition();
      setDictating(false);
      return;
    }
    const base = input.trim() ? `${input.trim()} ` : "";
    const started = startRecognition({
      onInterim: (text) => setInput(base + text),
      onFinal: (text) => {
        setInput(base + text);
        setDictating(false);
      },
      onSilence: () => setDictating(false)
    });
    setDictating(started);
  }, [dictating, input, setInput, startRecognition, stopRecognition]);

  const toggleVoiceMode = useCallback(() => {
    if (voiceModeRef.current) {
      voiceModeRef.current = false;
      awaitingReplyRef.current = false;
      setVoiceMode(false);
      stopRecognition();
      stopSpeaking();
      setPhase("off");
      return;
    }
    if (dictating) {
      stopRecognition();
      setDictating(false);
    }
    voiceModeRef.current = true;
    setVoiceMode(true);
    emptyListensRef.current = 0;
    markAllSpoken();
    if (isLoadingRef.current) {
      // A reply is already streaming — listen once it's done.
      awaitingReplyRef.current = true;
      setPhase("thinking");
    } else {
      listen();
    }
  }, [dictating, listen, markAllSpoken, stopRecognition, stopSpeaking]);

  /** Stop the assistant talking (and the mic) and listen to the rep right away. */
  const interrupt = useCallback(() => {
    stopSpeaking();
    stopRecognition();
    awaitingReplyRef.current = false;
    // Skip whatever is left of the current reply rather than reading it later.
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (last) spokenRef.current = { id: last.id, upTo: Number.MAX_SAFE_INTEGER };
    emptyListensRef.current = 0;
    listen();
  }, [listen, messages, stopRecognition, stopSpeaking]);

  // Tidy up on unmount (leaving the page shouldn't keep talking or listening).
  useEffect(
    () => () => {
      voiceModeRef.current = false;
      recognitionRef.current?.abort();
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    []
  );

  return {
    recognitionSupported,
    synthesisSupported,
    dictating,
    toggleDictation,
    voiceMode,
    toggleVoiceMode,
    phase,
    interim,
    interrupt,
    error,
    dismissError: () => setError(null)
  };
}
