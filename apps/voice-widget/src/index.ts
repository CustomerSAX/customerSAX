/**
 * CSA voice support widget.
 *
 *   <script src="https://<ai-assist>/voice/widget.js" data-widget-key="…" defer></script>
 *
 * Everything speech-related uses free, built-in browser APIs:
 *  - SpeechRecognition (Chrome, Edge, Safari) turns the caller's speech into text.
 *  - speechSynthesis (all major browsers) reads the agent's replies aloud.
 * Where recognition is missing (Firefox) or the mic is blocked, the caller can
 * type instead; replies are still spoken.
 *
 * Each utterance is POSTed to ai-assist /voice/turn, which answers as a
 * server-sent event stream. Replies are spoken sentence by sentence as they
 * stream in. The mic is off while the agent speaks, so it never hears itself.
 */

import { STYLES } from "./styles";

// ---------------------------------------------------------------------------
// Minimal Web Speech typings (not shipped in TypeScript's DOM lib)
// ---------------------------------------------------------------------------

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
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

const RecognitionImpl: RecognitionCtor | undefined =
  (window as unknown as { SpeechRecognition?: RecognitionCtor }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition;

const synth: SpeechSynthesis | undefined = "speechSynthesis" in window ? window.speechSynthesis : undefined;

// ---------------------------------------------------------------------------
// Config from the embedding <script> tag
// ---------------------------------------------------------------------------

const script =
  (document.currentScript as HTMLScriptElement | null) ??
  document.querySelector<HTMLScriptElement>("script[data-widget-key]");
const widgetKey = script?.dataset.widgetKey ?? "";
const apiBase = (script?.dataset.apiBase || (script?.src ? new URL(script.src).origin : "")).replace(/\/$/, "");

const ICONS = {
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  micOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 3l18 18M9 9v2a3 3 0 0 0 5 2.2M15 9.3V6a3 3 0 0 0-5.7-1.3M5 11a7 7 0 0 0 11.5 5.4M19 11a7 7 0 0 1-.6 2.8M12 18v3"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>',
  hangup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 15c5-5 13-5 18 0l-2.5 2.5-3-1.5v-2.5a10 10 0 0 0-5 0V16l-3 1.5z"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
};

type State = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "ready" | "ended";

const STATUS_TEXT: Record<State, string> = {
  idle: "",
  connecting: "Connecting…",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  ready: "Type a message, or tap the mic to talk",
  ended: "Conversation ended"
};

const ERROR_TEXT: Record<string, string> = {
  unknown_widget: "Voice support isn't available on this site.",
  origin_not_allowed: "Voice support isn't available on this site.",
  rate_limited: "Too many conversations were started from here. Please try again later.",
  voice_unavailable: "Voice support is temporarily unavailable. Please try again later.",
  session_expired: "This conversation has expired. Start a new one to continue.",
  session_ended: "This conversation has ended.",
  turn_limit: "This conversation has reached its length limit. Start a new one to continue."
};

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

class VoiceWidget {
  private root: ShadowRoot;
  private el: Record<string, HTMLElement> = {};
  private state: State = "idle";
  private sessionId: string | null = null;
  private lang = document.documentElement.lang || "en-US";
  private muted = !RecognitionImpl;
  private micBlocked = false;
  private recognition: Recognition | null = null;
  private emptyListens = 0;
  private turnAbort: AbortController | null = null;
  private speechQueue: string[] = [];
  private speaking = false;
  private streamDone = true;
  private endAfterSpeech = false;
  private speechWatchdog: number | undefined;

  constructor(host: HTMLElement) {
    this.root = host.attachShadow({ mode: "open" });
    this.root.innerHTML = `
      <style>${STYLES}</style>
      <button class="launcher" part="launcher" aria-haspopup="dialog">${ICONS.mic}<span>Talk to us</span></button>
      <section class="panel" role="dialog" aria-label="Voice support" hidden>
        <div class="header">
          <span class="title">Voice support</span>
          <button class="icon-btn close" aria-label="Close">${ICONS.close}</button>
        </div>
        <div class="intro">
          <p>You're talking to an automated assistant that can look up your orders and pass your request to our support team.</p>
          <p>Your speech is converted to text by your browser's speech service, and the conversation is saved so our team can follow up.</p>
          <button class="primary start">Start conversation</button>
        </div>
        <div class="status" aria-live="polite" hidden><span class="dot"></span><span class="status-text"></span><span class="chips"></span></div>
        <div class="captions" aria-live="polite" hidden></div>
        <div class="controls" hidden>
          <button class="ctrl mic"></button>
          <button class="ctrl interrupt" aria-label="Stop the assistant speaking">${ICONS.stop}<span>Interrupt</span></button>
          <button class="ctrl end" aria-label="End conversation">${ICONS.hangup}<span>End</span></button>
        </div>
        <form class="composer" hidden>
          <input type="text" maxlength="500" placeholder="Type instead (e.g. to spell your email)" aria-label="Type a message" />
          <button type="submit">Send</button>
        </form>
      </section>`;

    const q = (sel: string) => this.root.querySelector(sel) as HTMLElement;
    for (const name of ["launcher", "panel", "close", "intro", "start", "status", "captions", "controls", "mic", "interrupt", "end", "composer"]) {
      this.el[name] = q(`.${name}`);
    }
    this.el.statusText = q(".status-text");
    this.el.chips = q(".chips");
    this.el.input = q(".composer input");
    this.el.send = q(".composer button");

    this.el.launcher.addEventListener("click", () => this.open());
    this.el.close.addEventListener("click", () => this.close());
    this.el.start.addEventListener("click", () => void this.start());
    this.el.mic.addEventListener("click", () => this.toggleMic());
    this.el.interrupt.addEventListener("click", () => this.interrupt());
    this.el.end.addEventListener("click", () => this.end());
    this.el.composer.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = this.el.input as HTMLInputElement;
      const text = input.value.trim();
      if (!text || !this.sessionId || this.state === "ended") return;
      input.value = "";
      this.stopSpeaking();
      this.stopListening();
      void this.sendTurn(text);
    });
    window.addEventListener("pagehide", () => this.notifyEnd());
    this.render();
  }

  // ── Panel lifecycle ──────────────────────────────────────────────────────

  private open() {
    this.el.launcher.hidden = true;
    this.el.panel.hidden = false;
    (this.sessionId ? this.el.input : this.el.start).focus();
  }

  private close() {
    if (this.sessionId && this.state !== "ended") this.end();
    this.el.panel.hidden = true;
    this.el.launcher.hidden = false;
    this.el.launcher.focus();
  }

  private async start() {
    (this.el.start as HTMLButtonElement).disabled = true;
    this.el.captions.innerHTML = "";
    this.el.chips.innerHTML = "";
    this.endAfterSpeech = false;
    this.setState("connecting");
    this.el.intro.hidden = true;
    this.el.status.hidden = false;
    this.el.captions.hidden = false;
    try {
      const res = await fetch(`${apiBase}/voice/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widgetKey })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "voice_unavailable");
      this.sessionId = data.sessionId;
      if (typeof data.lang === "string") this.lang = data.lang;
      this.el.controls.hidden = false;
      this.el.composer.hidden = false;
      this.addMessage("assistant", data.greeting);
      this.streamDone = true;
      this.enqueueSpeech(data.greeting);
      this.afterSpeech(); // no-op while speaking; starts listening when there is no TTS
    } catch (err) {
      this.sessionId = null;
      this.addNotice(ERROR_TEXT[(err as Error).message] ?? ERROR_TEXT.voice_unavailable);
      this.setState("ended");
      this.showRestart();
    } finally {
      (this.el.start as HTMLButtonElement).disabled = false;
    }
  }

  private end() {
    this.stopSpeaking();
    this.stopListening();
    this.turnAbort?.abort();
    this.notifyEnd();
    this.setState("ended");
    this.addNotice("Conversation ended.");
    this.showRestart();
  }

  private notifyEnd() {
    if (!this.sessionId) return;
    const body = JSON.stringify({ sessionId: this.sessionId });
    this.sessionId = null;
    void fetch(`${apiBase}/voice/end`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  }

  private showRestart() {
    this.el.controls.hidden = true;
    this.el.composer.hidden = true;
    this.el.intro.hidden = false;
    this.el.status.hidden = true;
    this.el.start.textContent = "Start a new conversation";
  }

  // ── A turn: text → /voice/turn → streamed reply ─────────────────────────

  private async sendTurn(text: string) {
    if (!this.sessionId) return;
    this.addMessage("user", text);
    this.setState("thinking");
    const reply = this.addMessage("assistant", "");
    let sentenceBuffer = "";
    this.streamDone = false;
    this.turnAbort = new AbortController();

    try {
      const res = await fetch(`${apiBase}/voice/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: this.sessionId, text }),
        signal: this.turnAbort.signal
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "voice_unavailable");
      }

      for await (const { event, data } of readSse(res.body)) {
        if (event === "delta") {
          reply.textContent += data.text;
          sentenceBuffer += data.text;
          const { sentences, rest } = splitSentences(sentenceBuffer);
          sentenceBuffer = rest;
          sentences.forEach((s) => this.enqueueSpeech(s));
          this.scrollCaptions();
        } else if (event === "status") {
          if (data.type === "verified") this.addChip("Verified");
          if (data.type === "ticket") this.addChip(data.ticketNumber ? `Ticket ${data.ticketNumber}` : "Ticket created");
          if (data.type === "ended") this.endAfterSpeech = true;
        } else if (event === "error") {
          if (!reply.textContent) {
            reply.textContent = data.message;
            sentenceBuffer += data.message;
          }
        } else if (event === "done" && data.ended) {
          this.endAfterSpeech = true;
        }
      }
      if (sentenceBuffer.trim()) this.enqueueSpeech(sentenceBuffer);
      if (!reply.textContent) reply.remove();
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        if (!reply.textContent) reply.remove();
      } else {
        reply.remove();
        const code = (err as Error).message;
        this.addNotice(ERROR_TEXT[code] ?? "Sorry, the connection dropped. Please try again.");
        if (code in ERROR_TEXT && code !== "voice_unavailable") {
          this.end();
          return;
        }
      }
    } finally {
      this.turnAbort = null;
      this.streamDone = true;
      this.afterSpeech();
    }
  }

  // ── Speech synthesis ─────────────────────────────────────────────────────

  private enqueueSpeech(text: string) {
    const clean = text.trim();
    if (!clean) return;
    if (!synth) return; // no TTS available — captions still show the reply
    this.speechQueue.push(clean);
    if (!this.speaking) this.speakNext();
  }

  private speakNext() {
    const next = this.speechQueue.shift();
    if (!next || !synth) {
      this.speaking = false;
      if (!this.streamDone && this.state === "speaking") this.setState("thinking");
      this.afterSpeech();
      return;
    }
    this.speaking = true;
    this.setState("speaking");
    const utterance = new SpeechSynthesisUtterance(next);
    utterance.lang = this.lang;
    const voice = synth.getVoices().find((v) => v.lang === this.lang) ?? synth.getVoices().find((v) => v.lang.startsWith(this.lang.slice(0, 2)));
    if (voice) utterance.voice = voice;
    let finished = false;
    const done = () => {
      // onend, onerror and the watchdog can all fire — advance only once.
      if (finished) return;
      finished = true;
      window.clearTimeout(this.speechWatchdog);
      if (this.speaking) this.speakNext();
    };
    utterance.onend = done;
    utterance.onerror = done;
    // Some browsers occasionally never fire onend; don't let that wedge the call.
    this.speechWatchdog = window.setTimeout(done, 2000 + next.length * 90);
    synth.speak(utterance);
  }

  private stopSpeaking() {
    this.speechQueue = [];
    this.speaking = false;
    window.clearTimeout(this.speechWatchdog);
    synth?.cancel();
  }

  /** Called whenever speech or the reply stream may have finished: decide what's next. */
  private afterSpeech() {
    if (this.speaking || !this.streamDone || this.state === "ended") return;
    if (this.endAfterSpeech) {
      this.end();
      return;
    }
    this.listen();
  }

  private interrupt() {
    this.turnAbort?.abort();
    this.stopSpeaking();
    this.streamDone = true;
    this.afterSpeech();
  }

  // ── Speech recognition ───────────────────────────────────────────────────

  private listen() {
    if (!this.sessionId || this.state === "ended" || this.recognition) return;
    if (this.muted || this.micBlocked || !RecognitionImpl) {
      this.setState("ready");
      return;
    }
    const recognition = new RecognitionImpl();
    recognition.lang = this.lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    let finalText = "";
    let interim: HTMLElement | null = null;

    recognition.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      if (interimText) {
        interim ??= this.addMessage("user", "", true);
        interim.textContent = interimText;
        this.scrollCaptions();
      }
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        this.micBlocked = true;
        this.addNotice("Microphone access is blocked, so please type your messages instead.");
      } else if (event.error === "network") {
        this.micBlocked = true;
        this.addNotice("Speech recognition isn't reachable right now, so please type your messages instead.");
      }
    };
    recognition.onend = () => {
      interim?.remove();
      if (this.recognition !== recognition) return; // stopped on purpose
      this.recognition = null;
      const text = finalText.trim();
      if (text) {
        this.emptyListens = 0;
        void this.sendTurn(text);
      } else if (!this.micBlocked && ++this.emptyListens < 3 && this.state === "listening") {
        this.listen(); // silence timeout — keep listening a little longer
      } else {
        this.emptyListens = 0;
        this.setState("ready");
      }
    };

    this.recognition = recognition;
    this.setState("listening");
    try {
      recognition.start();
    } catch {
      this.recognition = null;
      this.setState("ready");
    }
  }

  private stopListening() {
    const recognition = this.recognition;
    this.recognition = null;
    recognition?.abort();
  }

  private toggleMic() {
    if (!RecognitionImpl) return;
    if (this.state === "listening") {
      this.muted = true;
      this.stopListening();
      this.setState("ready");
      return;
    }
    this.muted = false;
    this.micBlocked = false;
    this.emptyListens = 0;
    if (this.state === "ready") this.listen();
    this.render();
  }

  // ── Rendering ────────────────────────────────────────────────────────────

  private setState(state: State) {
    this.state = state;
    this.render();
  }

  private render() {
    this.el.status.dataset.state = this.state;
    this.el.statusText.textContent = STATUS_TEXT[this.state];
    const mic = this.el.mic as HTMLButtonElement;
    const listening = this.state === "listening";
    mic.disabled = !RecognitionImpl || this.state === "thinking" || this.state === "speaking";
    mic.innerHTML = `${listening ? ICONS.micOff : ICONS.mic}<span>${!RecognitionImpl ? "No mic support" : listening ? "Stop listening" : "Talk"}</span>`;
    mic.setAttribute("aria-label", listening ? "Stop listening" : "Start talking");
    (this.el.interrupt as HTMLButtonElement).disabled = !(this.state === "speaking" || this.state === "thinking");
    const inputDisabled = !this.sessionId || this.state === "ended";
    (this.el.input as HTMLInputElement).disabled = inputDisabled;
    (this.el.send as HTMLButtonElement).disabled = inputDisabled;
  }

  private addMessage(role: "user" | "assistant", text: string, interim = false): HTMLElement {
    const div = document.createElement("div");
    div.className = `msg ${role}${interim ? " interim" : ""}`;
    div.textContent = text;
    this.el.captions.appendChild(div);
    this.scrollCaptions();
    return div;
  }

  private addNotice(text: string) {
    const div = document.createElement("div");
    div.className = "notice";
    div.textContent = text;
    this.el.captions.appendChild(div);
    this.scrollCaptions();
  }

  private addChip(text: string) {
    const span = document.createElement("span");
    span.className = "chip";
    span.textContent = text;
    this.el.chips.appendChild(span);
  }

  private scrollCaptions() {
    this.el.captions.scrollTop = this.el.captions.scrollHeight;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Splits complete sentences off the front of a streaming buffer. */
function splitSentences(buffer: string): { sentences: string[]; rest: string } {
  const sentences: string[] = [];
  const re = /[^.!?]*[.!?]+["')\]]*\s+/g;
  let consumed = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(buffer)) !== null) {
    sentences.push(match[0]);
    consumed = re.lastIndex;
  }
  return { sentences, rest: buffer.slice(consumed) };
}

/** Parses a text/event-stream body into { event, data } records. */
async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<{ event: string; data: any }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      let event = "message";
      let data = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (data) {
        try {
          yield { event, data: JSON.parse(data) };
        } catch {
          // ignore a malformed frame
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function boot() {
  if (!widgetKey || document.getElementById("csa-voice-widget")) return;
  const host = document.createElement("div");
  host.id = "csa-voice-widget";
  document.body.appendChild(host);
  new VoiceWidget(host);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
