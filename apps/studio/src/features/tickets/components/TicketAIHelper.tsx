"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Check,
  ChevronDown,
  RotateCcw,
  Sparkles,
  Ticket,
  X
} from "lucide-react";

type Message = { role: "assistant" | "user"; text: string };
type Draft = { email: string; subject: string; description: string; priority: string };
type Step = "issue" | "email" | "review";

const greeting: Message = {
  role: "assistant",
  text: "Hi! Let’s put a ticket together. Describe the customer’s issue, and I’ll guide you through the details."
};
const starters = [
  "An order hasn’t arrived",
  "A customer needs a return",
  "Help with an account issue"
];
const buttonStyle =
  "rounded-lg p-2 transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current";

/** UI-only prototype: all messages and drafts stay in component state. */
export function TicketAIHelper() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([greeting]);
  const [input, setInput] = useState("");
  const [step, setStep] = useState<Step>("issue");
  const [draft, setDraft] = useState<Draft>({
    email: "",
    subject: "",
    description: "",
    priority: "Medium"
  });
  const [reviewed, setReviewed] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open, reviewed]);

  function close() {
    setOpen(false);
    launcherRef.current?.focus();
  }

  function reset() {
    setMessages([greeting]);
    setInput("");
    setDraft({ email: "", subject: "", description: "", priority: "Medium" });
    setStep("issue");
    setReviewed(false);
    inputRef.current?.focus();
  }

  function send(value = input) {
    const text = value.trim();
    if (!text) return;
    let reply: string;
    if (step === "issue") {
      setDraft((current) => ({
        ...current,
        subject: text.slice(0, 100),
        description: text
      }));
      setStep("email");
      reply =
        "Got it. What’s the customer’s email address? For this demo, you can use an example address.";
    } else if (step === "email") {
      const email = text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)?.[0];
      if (email) {
        setDraft((current) => ({ ...current, email }));
        setStep("review");
        reply =
          "Here’s your ticket draft. You can edit the details below before marking it reviewed. The customer hasn’t been verified in this demo.";
      } else {
        reply =
          "Please enter an email address, such as customer@example.com, so I can include it in the draft.";
      }
    } else {
      setDraft((current) => ({
        ...current,
        description: `${current.description}\n\n${text}`
      }));
      setReviewed(false);
      reply =
        "I’ve added that to the description. You can make any other changes directly in the draft below.";
    }
    setMessages((current) => [
      ...current,
      { role: "user", text },
      { role: "assistant", text: reply }
    ]);
    setInput("");
    inputRef.current?.focus();
  }

  const fieldStyle =
    "mt-1 w-full rounded-lg border border-m-border bg-m-surface px-3 py-2 text-sm font-normal text-m-text outline-none focus:border-m-primary focus:ring-2 focus:ring-m-primary/20";

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <section
          id="ticket-ai-helper"
          role="dialog"
          aria-modal="false"
          aria-labelledby="ticket-ai-title"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              close();
            }
          }}
          className="flex h-[min(640px,calc(100dvh-112px))] w-[calc(100vw-32px)] max-w-[400px] flex-col overflow-hidden rounded-2xl border border-m-border bg-m-surface text-m-text shadow-[0_16px_64px_-12px_rgba(15,23,42,0.3)]"
        >
          <header className="flex shrink-0 items-center gap-3 bg-gradient-to-br from-blue-600 to-blue-800 px-5 py-4 text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/15">
              <Sparkles size={21} aria-hidden="true" />
            </span>
            <div className="flex-1">
              <h2 id="ticket-ai-title" className="text-sm font-semibold">
                Ticket AI helper
              </h2>
              <p className="mt-0.5 text-xs text-blue-100">
                A little help, from issue to ticket
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              title="Start a new draft"
              aria-label="Start a new draft"
              className={buttonStyle}
            >
              <RotateCcw size={16} />
            </button>
            <button
              type="button"
              onClick={close}
              title="Minimize chat"
              aria-label="Minimize chat"
              className={buttonStyle}
            >
              <ChevronDown size={19} />
            </button>
          </header>

          <div className="flex shrink-0 items-center gap-2 border-b border-m-border bg-m-surface-2 px-5 py-2.5 text-xs text-m-text-muted">
            <span className="rounded bg-blue-100 px-1.5 py-0.5 font-semibold text-blue-700">
              UI preview
            </span>
            Demo chat · No tickets will be created
          </div>

          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5"
          >
            <div
              role="log"
              aria-label="Ticket helper conversation"
              aria-live="polite"
              aria-relevant="additions"
              className="space-y-4"
            >
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-2 ${message.role === "user" ? "justify-end" : ""}`}
                >
                  {message.role === "assistant" && (
                    <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Sparkles size={14} aria-hidden="true" />
                    </span>
                  )}
                  <div
                    className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-3 text-sm leading-relaxed ${message.role === "user" ? "rounded-br-sm bg-blue-600 text-white" : "rounded-tl-sm bg-m-surface-2 text-m-text"}`}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
            </div>

            {step === "issue" && (
              <div className="ml-8 mt-5 space-y-2">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-m-text-muted">
                  Try a starting point
                </p>
                {starters.map((text) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => send(text)}
                    className="flex w-full items-center gap-2 rounded-xl border border-m-border px-3 py-2.5 text-left text-xs transition hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-blue-600"
                  >
                    <Ticket
                      size={14}
                      className="shrink-0 text-blue-600"
                      aria-hidden="true"
                    />
                    {text}
                  </button>
                ))}
              </div>
            )}

            {step === "review" && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setReviewed(true);
                }}
                className="mt-5 overflow-hidden rounded-xl border border-m-border"
              >
                <div className="flex items-center gap-2 border-b border-m-border bg-m-surface-2 px-4 py-3 text-sm font-semibold">
                  <Ticket size={16} className="text-blue-600" aria-hidden="true" /> Ticket
                  draft{" "}
                  <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-m-text-muted">
                    Preview only
                  </span>
                </div>
                <div className="space-y-3 p-4">
                  {(
                    [
                      ["email", "Customer email"],
                      ["subject", "Subject"]
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="block text-xs font-medium">
                      {label}
                      <input
                        required
                        maxLength={key === "subject" ? 100 : 254}
                        type={key === "email" ? "email" : "text"}
                        value={draft[key]}
                        onChange={(event) => {
                          setDraft({ ...draft, [key]: event.target.value });
                          setReviewed(false);
                        }}
                        className={fieldStyle}
                      />
                    </label>
                  ))}
                  <label className="block text-xs font-medium">
                    Description
                    <textarea
                      required
                      rows={3}
                      value={draft.description}
                      onChange={(event) => {
                        setDraft({ ...draft, description: event.target.value });
                        setReviewed(false);
                      }}
                      className={`${fieldStyle} resize-y`}
                    />
                  </label>
                  <label className="block text-xs font-medium">
                    Priority
                    <select
                      value={draft.priority}
                      onChange={(event) => {
                        setDraft({ ...draft, priority: event.target.value });
                        setReviewed(false);
                      }}
                      className={fieldStyle}
                    >
                      {["Low", "Medium", "High", "Urgent"].map((priority) => (
                        <option key={priority}>{priority}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="submit"
                    disabled={reviewed}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-blue-600 disabled:bg-blue-100 disabled:text-blue-800"
                  >
                    <Check size={16} aria-hidden="true" />
                    {reviewed ? "Draft reviewed" : "Mark draft reviewed"}
                  </button>
                  {reviewed && (
                    <p
                      role="status"
                      className="text-xs leading-relaxed text-m-text-muted"
                    >
                      Demo complete. Your draft is reviewed; no ticket has been submitted.
                    </p>
                  )}
                </div>
              </form>
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
            className="shrink-0 border-t border-m-border bg-m-surface p-4"
          >
            <div className="flex items-end gap-2 rounded-xl border border-m-border bg-m-surface px-3 py-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10">
              <textarea
                ref={inputRef}
                aria-label="Message the ticket AI helper"
                rows={2}
                maxLength={4000}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={
                  step === "email"
                    ? "Enter the customer’s email…"
                    : step === "review"
                      ? "Add more details…"
                      : "Describe the customer’s issue…"
                }
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    send();
                  }
                }}
                className="max-h-28 min-w-0 flex-1 resize-none bg-transparent py-1 text-sm text-m-text outline-none placeholder:text-m-text-muted"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                aria-label="Send message"
                className="mb-0.5 rounded-lg bg-blue-600 p-2 text-white transition hover:bg-blue-700 focus-visible:outline-blue-600 disabled:bg-m-surface-2 disabled:text-m-text-muted"
              >
                <ArrowUp size={17} />
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-m-text-muted">
              Demo responses · Review all details before creating a ticket
            </p>
          </form>
        </section>
      )}

      <button
        ref={launcherRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={open ? "Close ticket AI helper" : "Open ticket AI helper"}
        aria-expanded={open}
        aria-controls={open ? "ticket-ai-helper" : undefined}
        title="Ticket AI helper"
        className="group flex h-14 items-center gap-2 rounded-full border border-white/20 bg-gradient-to-br from-blue-600 to-blue-800 px-4 text-white shadow-lg shadow-blue-800/25 transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 motion-reduce:transform-none"
      >
        {open ? (
          <X size={22} aria-hidden="true" />
        ) : (
          <Sparkles size={22} aria-hidden="true" />
        )}
        {!open && <span className="text-sm font-semibold">AI helper</span>}
      </button>
    </div>
  );
}
