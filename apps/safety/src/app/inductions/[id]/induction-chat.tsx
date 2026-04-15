"use client";

import { useState, useRef, useEffect } from "react";

type Message = { role: "user" | "assistant"; content: string };

export function InductionChat({
  projectName,
  templateTitle,
  retryCount = 0,
}: {
  projectName: string;
  templateTitle: string;
  retryCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() =>
    retryCount > 0
      ? [
          {
            role: "assistant",
            content:
              "I can see you're on a retry attempt. I can help point you to the relevant section of the induction material for any question you're unsure about — just ask me about any topic or question number.",
          },
        ]
      : [],
  );
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [open, messages]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");

    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setStreaming(true);

    // Placeholder for the assistant reply
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/induction-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, projectName, templateTitle }),
      });
      if (!response.body) throw new Error("No stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const updated = [...m];
          updated[updated.length - 1] = { role: "assistant", content: accumulated };
          return updated;
        });
      }
    } catch {
      setMessages((m) => {
        const updated = [...m];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Sorry, I'm unable to respond right now.",
        };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-4 z-50 flex w-80 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 sm:right-6 sm:w-96">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800/50">
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Safety assistant
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Ask about this induction
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 max-h-80">
            {messages.length === 0 && (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-4">
                Ask me anything about site safety or this induction.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  {m.content || (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-zinc-100 p-3 dark:border-zinc-800">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question…"
                rows={1}
                disabled={streaming}
                className="flex-1 resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                style={{ maxHeight: "120px" }}
              />
              <button
                onClick={send}
                disabled={!input.trim() || streaming}
                className="flex-shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 sm:right-6"
      >
        <span>{open ? "✕" : "?"}</span>
        <span>{open ? "Close" : "Safety assistant"}</span>
      </button>
    </>
  );
}
