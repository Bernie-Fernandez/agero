'use client';
import { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { sendChatbotMessage, endChatbotSession } from '../actions';

type Message = { id: string; role: string; content: string; createdAt: Date };
type Session = {
  id: string; title: string | null; endedAt: Date | null;
  user: { firstName: string; lastName: string };
  source: { id: string; title: string } | null;
  messages: Message[];
};

export default function ChatbotSessionClient({ session: initialSession }: { session: Session }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialSession.messages);
  const [input, setInput] = useState('');
  const [sending, startSend] = useTransition();
  const [ending, startEnd] = useTransition();
  const [ended, setEnded] = useState(!!initialSession.endedAt);
  const [endedSourceId, setEndedSourceId] = useState(initialSession.source?.id ?? null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending || ended) return;
    const text = input.trim();
    setInput('');
    const userMsg: Message = { id: `tmp-${Date.now()}`, role: 'USER', content: text, createdAt: new Date() };
    setMessages((prev) => [...prev, userMsg]);

    startSend(async () => {
      const reply = await sendChatbotMessage(initialSession.id, text);
      const assistantMsg: Message = { id: `tmp-${Date.now()}-a`, role: 'ASSISTANT', content: reply, createdAt: new Date() };
      setMessages((prev) => [...prev, assistantMsg]);
    });
  }

  function handleEnd() {
    startEnd(async () => {
      await endChatbotSession(initialSession.id);
      setEnded(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-48px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/design/chatbot" className="text-zinc-400 hover:text-zinc-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <p className="text-sm font-semibold text-zinc-900">{initialSession.title ?? 'Design Studio Chat'}</p>
            <p className="text-xs text-zinc-400">{initialSession.user.firstName} {initialSession.user.lastName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {ended ? (
            <>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">Session ended</span>
              {endedSourceId && (
                <Link href={`/design/sources/${endedSourceId}`} className="text-xs text-brand hover:underline">View source</Link>
              )}
            </>
          ) : (
            <button onClick={handleEnd} disabled={ending}
              className="px-3 py-1.5 border border-zinc-200 text-zinc-700 text-sm font-medium rounded-md hover:bg-zinc-50 disabled:opacity-50">
              {ending ? 'Ending…' : 'End Session'}
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-zinc-50">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-500 text-sm font-medium">Start the conversation</p>
            <p className="text-zinc-400 text-xs mt-1">Ask about design principles, past projects, space planning, or anything you want to save to the knowledge base.</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'USER' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-lg px-4 py-2.5 text-sm ${
              m.role === 'USER'
                ? 'bg-brand text-white'
                : 'bg-white border border-zinc-200 text-zinc-800'
            }`}>
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-white border border-zinc-200 rounded-lg px-4 py-2.5">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!ended && (
        <form onSubmit={handleSend} className="px-6 py-4 border-t border-zinc-200 bg-white shrink-0">
          <div className="flex gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              disabled={sending}
              className="flex-1 border border-zinc-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e as never); } }}
            />
            <button type="submit" disabled={sending || !input.trim()}
              className="px-4 py-2.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 disabled:opacity-50">
              Send
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
