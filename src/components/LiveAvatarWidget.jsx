import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MessageCircle, X, Loader2, AlertTriangle, Volume2, Bot, User, MessageSquare } from 'lucide-react';
import { LiveAvatarSession, SessionEvent, AgentEventsEnum } from '@heygen/liveavatar-web-sdk';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ─── Text Chat (standalone) ──
function TextChat() {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi! I'm FY Intech's AI assistant. Ask me anything!" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const sid = useRef('visitor-' + Date.now());
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    const t = input.trim();
    if (!t || loading) return;
    setInput('');
    setMessages(p => [...p, { role: 'user', text: t }]);
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/public/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: t, session_id: sid.current }) });
      const d = await r.json();
      setMessages(p => [...p, { role: 'assistant', text: d.reply }]);
    } catch { setMessages(p => [...p, { role: 'assistant', text: 'Sorry, having trouble. Email ask@fyintech.com!' }]); }
    setLoading(false);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && <div className="w-7 h-7 rounded-full bg-cyan-600 flex items-center justify-center flex-shrink-0 mt-1"><Bot size={14} /></div>}
            <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${m.role === 'user' ? 'bg-cyan-600 text-white rounded-br-md' : 'bg-gray-800 text-gray-100 rounded-bl-md'}`}>{m.text}</div>
            {m.role === 'user' && <div className="w-7 h-7 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0 mt-1"><User size={14} /></div>}
          </div>
        ))}
        {loading && <div className="flex gap-2 justify-start"><div className="w-7 h-7 rounded-full bg-cyan-600 flex items-center justify-center flex-shrink-0 mt-1"><Bot size={14} /></div><div className="bg-gray-800 text-gray-400 px-4 py-2 rounded-2xl rounded-bl-md text-sm"><span className="animate-pulse">Thinking...</span></div></div>}
        <div ref={endRef} />
      </div>
      <div className="border-t border-gray-700 p-3 flex gap-2 shrink-0">
        <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Ask about our VR solutions..." className="flex-1 bg-gray-800 text-white text-sm rounded-xl px-4 py-2.5 outline-none border border-gray-700 focus:border-cyan-500 placeholder-gray-500" />
        <button onClick={send} disabled={loading || !input.trim()} className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-xl px-3 py-2.5 transition-colors"><MessageCircle size={18} /></button>
      </div>
    </div>
  );
}

// ─── Main Widget ──
function LiveAvatarWidget() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('choose'); // choose | loading | avatar | chat | error
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([]);
  const [statusText, setStatusText] = useState('');
  const sessionRef = useRef(null);
  const containerRef = useRef(null);
  const endRef = useRef(null);
  const cleanup = useRef(false);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const doCleanup = useCallback(() => {
    if (cleanup.current) return;
    cleanup.current = true;
    if (sessionRef.current) {
      try { sessionRef.current.stop(); } catch {}
      sessionRef.current = null;
    }
    if (containerRef.current) containerRef.current.innerHTML = '';
    cleanup.current = false;
  }, []);

  useEffect(() => () => { doCleanup(); }, [doCleanup]);

  const startAvatar = useCallback(async () => {
    doCleanup();
    setMode('loading');
    setError('');
    setMessages([]);
    setStatusText('Connecting...');

    try {
      const res = await fetch(`${API_BASE}/api/public/avatar-token`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json().catch(()=>({}))).detail || 'Failed');
      setStatusText('Starting session...');
      const data = await res.json();

      const session = new LiveAvatarSession(data.session_token, { voiceChat: true });

      // User speech
      session.on(AgentEventsEnum.USER_TRANSCRIPTION, (p) => {
        if (p?.text) setMessages(prev => {
          const c = [...prev];
          if (c.length > 0 && c[c.length-1]?.role === 'user' && !c[c.length-1]?.final) c[c.length-1] = { role: 'user', text: p.text, final: false };
          else c.push({ role: 'user', text: p.text, final: false });
          return c;
        });
      });
      session.on(AgentEventsEnum.USER_SPEAK_ENDED, () => setMessages(prev => {
        const c = [...prev];
        if (c.length > 0 && c[c.length-1]?.role === 'user') c[c.length-1] = { ...c[c.length-1], final: true };
        return c;
      }));

      // Avatar speech
      session.on(AgentEventsEnum.AVATAR_TRANSCRIPTION, (p) => {
        if (p?.text) setMessages(prev => {
          const c = [...prev];
          if (c.length > 0 && c[c.length-1]?.role === 'assistant' && !c[c.length-1]?.final) c[c.length-1] = { role: 'assistant', text: p.text, final: false };
          else c.push({ role: 'assistant', text: p.text, final: false });
          return c;
        });
      });
      session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => setMessages(prev => {
        const c = [...prev];
        if (c.length > 0 && c[c.length-1]?.role === 'assistant') c[c.length-1] = { ...c[c.length-1], final: true };
        return c;
      }));

      // Stream ready — show video
      session.on(SessionEvent.SESSION_STREAM_READY, () => {
        if (containerRef.current) {
          const v = document.createElement('video');
          v.style.cssText = 'width:100%;height:100%;object-fit:cover';
          v.setAttribute('playsinline', '');
          v.setAttribute('autoplay', '');
          containerRef.current.appendChild(v);
          session.attach(v);
          setMessages([{ role: 'assistant', text: 'Connected! Speak to start the conversation.', final: true }]);
          setMode('avatar');
        }
      });

      // Disconnected
      session.on(SessionEvent.SESSION_DISCONNECTED, () => {
        sessionRef.current = null;
        if (containerRef.current) containerRef.current.innerHTML = '';
        setMessages(prev => [...prev, { role: 'assistant', text: 'Session ended.', final: true }]);
      });

      await Promise.race([
        session.start(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out. Try again.')), 25000))
      ]);
      sessionRef.current = session;

      setTimeout(() => {
        if (sessionRef.current) { try { session.stop(); } catch {} sessionRef.current = null; }
      }, 58000);

    } catch (err) {
      doCleanup();
      setError(err.message || 'Failed.');
      setMode('error');
    }
  }, [doCleanup]);

  const startChat = useCallback(() => setMode('chat'), []);

  return (
    <>
      {!open && <button onClick={() => { setOpen(true); setMode('choose'); setError(''); }} className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg hover:shadow-xl hover:scale-110 transition-all flex items-center justify-center"><MessageCircle size={24} /></button>}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[420px] h-[560px] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-700 text-white shrink-0">
            <div className="flex items-center gap-2"><Volume2 size={18} /><span className="font-semibold text-sm">{mode === 'chat' ? 'Text Chat' : 'FY Intech Assistant'}</span></div>
            <button onClick={() => { doCleanup(); setMessages([]); setMode('choose'); setOpen(false); }} className="hover:bg-white/20 p-1 rounded-lg"><X size={20} /></button>
          </div>

          <div className="flex-1 flex flex-col bg-gray-950 overflow-hidden">
            {mode === 'choose' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
                <div className="text-center mb-2"><p className="text-white text-base font-bold mb-1">How can I help you?</p><p className="text-gray-400 text-xs">Choose your preferred way to chat</p></div>
                <button onClick={startAvatar} className="w-full max-w-xs flex items-center gap-4 px-5 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl transition-all shadow-lg"><Volume2 size={20} /><div className="text-left"><p className="font-bold text-sm">Talking Avatar</p><p className="text-xs text-white/70">Voice + live transcript</p></div></button>
                <button onClick={startChat} className="w-full max-w-xs flex items-center gap-4 px-5 py-4 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-xl transition-all"><MessageSquare size={20} /><div className="text-left"><p className="font-bold text-sm">Text Chat</p><p className="text-xs text-white/70">Quick and simple</p></div></button>
              </div>
            )}

            {mode === 'loading' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <Loader2 size={28} className="animate-spin text-cyan-400" />
                <p className="text-white text-sm">{statusText}</p>
                <p className="text-gray-500 text-xs">Takes about 10 seconds</p>
              </div>
            )}

            {mode === 'error' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center max-w-xs mx-auto p-4">
                <AlertTriangle size={24} className="text-red-400" />
                <p className="text-white text-sm">{error}</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={startAvatar} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white text-sm">Try Again</button>
                  <button onClick={() => setMode('choose')} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm">Back</button>
                </div>
              </div>
            )}

            {mode === 'avatar' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div ref={containerRef} className="h-[180px] shrink-0 bg-black" />
                <div className="h-px bg-gray-700 shrink-0" />
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="px-3 py-1 bg-gray-900 border-b border-gray-800 shrink-0">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Live transcript</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {messages.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-gray-500 text-xs gap-2">
                        <Volume2 size={24} className="opacity-30" />
                        <p>Speak now — everything appears here automatically</p>
                      </div>
                    )}
                    {messages.map((m, i) => (
                      <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {m.role === 'assistant' && <div className="w-6 h-6 rounded-full bg-cyan-600 flex items-center justify-center flex-shrink-0 mt-0.5"><Bot size={12} /></div>}
                        <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${m.role === 'user' ? 'bg-cyan-600/20 text-white rounded-br-md border border-cyan-500/20' : 'bg-gray-800 text-gray-100 rounded-bl-md'}`}>{m.text}</div>
                        {m.role === 'user' && <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0 mt-0.5"><User size={12} /></div>}
                      </div>
                    ))}
                    <div ref={endRef} />
                  </div>
                </div>
                <p className="text-gray-500 text-[10px] text-center py-0.5 shrink-0 bg-gray-900">~1 min session</p>
              </div>
            )}

            {mode === 'chat' && <TextChat />}
          </div>
        </div>
      )}
    </>
  );
}

export default LiveAvatarWidget;
