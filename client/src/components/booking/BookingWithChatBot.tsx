"use client";

import { useState } from 'react';
import BookTicket from './BookTicket';
import { MessageCircle } from 'lucide-react';
import { sendChatMessage } from '@/lib/api';

export default function BookingWithChatBot() {
  const [messages, setMessages] = useState<{ from: 'user' | 'bot'; text: string }[]>([
    { from: 'bot', text: 'Hi! I can help with tickets — try asking about times, prices, or accessibility.' },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(`web-${Date.now()}`);

  const send = async () => {
    if (!input.trim()) return;
    const msg = { from: 'user' as const, text: input.trim() };
    setMessages((m) => [...m, msg]);
    setInput('');
    setSending(true);

    try {
      const response = await sendChatMessage(msg.text, sessionId);
      const reply = { from: 'bot' as const, text: response.response || 'I could not generate a response.' };
      setMessages((m) => [...m, reply]);
    } catch (error) {
      setMessages((m) => [
        ...m,
        {
          from: 'bot',
          text: (error as Error).message || 'Chat service is unavailable right now.'
        }
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        <h3 className="mb-4 text-2xl font-semibold"></h3>
        <BookTicket />
      </div>

      <aside className="rounded-lg border bg-background p-4">
        <div className="mb-4 flex items-center gap-2">
          <MessageCircle />
          <h4 className="text-lg font-medium">Chat with our assistant</h4>
        </div>

        <div className="mb-3 h-[420px] overflow-auto rounded border p-3">
          {messages.map((m, i) => (
            <div key={i} className={`mb-2 max-w-[85%] ${m.from === 'bot' ? 'text-sm text-muted-foreground' : 'ml-auto text-right'}`}>
              <div className={`inline-block rounded px-3 py-1 ${m.from === 'bot' ? 'bg-muted' : 'bg-primary text-primary-foreground'}`}>
                {m.text}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !sending && send()}
            placeholder="Ask me about tickets or schedules"
            className="flex-1 rounded border px-3 py-2"
            disabled={sending}
          />
          <button onClick={send} className="rounded bg-primary px-4 py-2 text-primary-foreground" disabled={sending}>
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </aside>
    </div>
  );
}
