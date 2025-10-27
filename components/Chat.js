// Minimal React chat component that calls /api/thesys
import { useState } from 'react';

export default function Chat() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]); // {role:'user'|'assistant', text}
  const [loading, setLoading] = useState(false);

  async function send() {
    const trimmed = input.trim();
    if (!trimmed) return;
    setMessages((m) => [...m, { role: 'user', text: trimmed }]);
    setInput('');
    setLoading(true);

    // Generic payload — update to match Thesys API schema if needed.
    const payload = { prompt: trimmed };

    try {
      const res = await fetch('/api/thesys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Upstream error');
      }

      const json = await res.json();

      // Try common fields; adjust extraction for actual Thesys response.
      const assistantText =
        json.output ||
        (Array.isArray(json.choices) && json.choices[0] && (json.choices[0].text || json.choices[0].message?.content)) ||
        JSON.stringify(json);

      setMessages((m) => [...m, { role: 'assistant', text: String(assistantText) }]);
    } catch (err) {
      console.error('Error calling /api/thesys', err);
      setMessages((m) => [...m, { role: 'assistant', text: 'Error: ' + String(err.message) }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ border: '1px solid #ddd', padding: 12, minHeight: 200 }}>
        {messages.length === 0 && <div style={{ color: '#666' }}>Say hi to Thesys — ask anything.</div>}
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <b>{msg.role}:</b> <span>{msg.text}</span>
          </div>
        ))}
        {loading && <div style={{ color: '#999' }}>Thinking…</div>}
      </div>

      <div style={{ display: 'flex', marginTop: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{ flex: 1, padding: 8 }}
          placeholder="Ask Thesys..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
        />
        <button onClick={send} style={{ marginLeft: 8, padding: '8px 12px' }} disabled={loading}>
          Send
        </button>
      </div>
    </div>
  );
}