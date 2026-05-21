import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MessageCircle, X, Loader2, AlertTriangle, Volume2, Send, Bot, User, MessageSquare } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ─── Pure Text Chat Component ─────────────────────────────────────────────
function TextChat({ onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi! I'm FY Intech's AI assistant. Ask me anything about our VR/AR solutions, past projects, or how we can help your business!" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const sessionId = useRef('visitor-' + Date.now());

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/public/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: sessionId.current }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', text: data.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, having trouble. Email ask@fyintech.com!' }]);
    }
    setLoading(false);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-cyan-600 flex items-center justify-center flex-shrink-0 mt-1"><Bot size={14} className="text-white" /></div>
            )}
            <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
              msg.role === 'user' ? 'bg-cyan-600 text-white rounded-br-md' : 'bg-gray-800 text-gray-100 rounded-bl-md'
            }`}>{msg.text}</div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0 mt-1"><User size={14} className="text-white" /></div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2 justify-start">
            <div className="w-7 h-7 rounded-full bg-cyan-600 flex items-center justify-center flex-shrink-0 mt-1"><Bot size={14} className="text-white" /></div>
            <div className="bg-gray-800 text-gray-400 px-4 py-2 rounded-2xl rounded-bl-md text-sm"><span className="animate-pulse">Typing...</span></div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="border-t border-gray-700 p-3 flex gap-2">
        <input type="text" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask about our VR solutions..." className="flex-1 bg-gray-800 text-white text-sm rounded-xl px-4 py-2.5 outline-none border border-gray-700 focus:border-cyan-500 placeholder-gray-500" />
        <button onClick={send} disabled={loading || !input.trim()}
          className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-xl px-3 py-2.5 transition-colors"><Send size={18} /></button>
      </div>
    </div>
  );
}

// ─── Main Widget ──────────────────────────────────────────────────────────
function LiveAvatarWidget() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('choose'); // closed | choose | loading-avatar | avatar | loading-chat | chat | error
  const [error, setError] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [subtitleText, setSubtitleText] = useState('');
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const endRef = useRef(null);
  const sessionId = useRef('visitor-' + Date.now());

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, subtitleText]);

  // ── Start Avatar ──
  const startAvatar = useCallback(async () => {
    setMode('loading-avatar');
    setError('');
    setEmbedUrl('');
    setMessages([]);
    setSubtitleText('');

    try {
      const res = await fetch(`${API_BASE}/api/public/avatar-embed`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error((await res.json().catch(()=>{})).detail || 'Failed');
      const data = await res.json();
      setEmbedUrl(data.url);
      setMode('avatar');
      setMessages([{ role: 'assistant', text: "Hi! I'm FY Intech's AI assistant. Ask me about our VR/AR solutions, past projects, or anything about FY Intech!", final: true }]);
    } catch (err) {
      setError(err.message);
      setMode('error');
    }
  }, []);

  // ── Start Text Chat ──
  const startChat = useCallback(() => {
    setMode('chat');
    setMessages([{ role: 'assistant', text: "Hi! I'm FY Intech's AI assistant. Ask me anything about our VR/AR solutions, past projects, or how we can help your business!" }]);
  }, []);

  // ── Send text chat (works in both avatar and chat mode) ──
  const sendChat = useCallback(async () => {
    const text = input.trim();
    if (!text || chatLoading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text, final: true }]);
    setChatLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/public/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: sessionId.current }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', text: data.reply, final: true }]);
      // Show latest reply as subtitle overlay
      setSubtitleText(data.reply);
      setTimeout(() => setSubtitleText(''), 8000);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, having trouble. Email ask@fyintech.com!', final: true }]);
    }
    setChatLoading(false);
  }, [input, chatLoading]);

  const stopAll = useCallback(() => {
    setEmbedUrl('');
    setMessages([]);
    setSubtitleText('');
    setMode('choose');
    setOpen(false);
  }, []);

  const handleOpen = () => {
    setOpen(true);
    setMode('choose');
    setError('');
    setEmbedUrl('');
    setMessages([]);
    setSubtitleText('');
  };

  return (
    <>
      {!open && (
        <button onClick={handleOpen}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg hover:shadow-xl hover:scale-110 transition-all flex items-center justify-center">
          <MessageCircle size={24} />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[420px] h-[560px] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-700 text-white shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                {mode === 'chat' ? <MessageSquare size={18} /> : <Volume2 size={18} />}
              </div>
              <div>
                <div className="font-semibold text-sm">
                  {mode === 'chat' ? 'FY Intech Chat' : 'FY Intech Assistant'}
                </div>
                <div className="text-xs text-white/70">
                  {mode === 'chat' ? 'Text chat' : mode === 'avatar' ? 'Talking avatar' : mode === 'choose' ? 'Choose mode' : mode === 'loading-avatar' ? 'Starting...' : ''}
                </div>
              </div>
            </div>
            <button onClick={stopAll} className="hover:bg-white/20 p-1 rounded-lg transition-colors"><X size={20} /></button>
          </div>

          {/* Body */}
          <div className="flex-1 flex flex-col bg-gray-950 overflow-hidden">
            {/* ── Choose Mode ── */}
            {mode === 'choose' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
                <div className="text-center mb-2">
                  <p className="text-white text-base font-bold mb-1">How can I help you?</p>
                  <p className="text-gray-400 text-xs">Choose your preferred way to chat</p>
                </div>
                <button onClick={startAvatar}
                  className="w-full max-w-xs flex items-center gap-4 px-5 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl transition-all shadow-lg">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0"><Volume2 size={20} /></div>
                  <div className="text-left">
                    <p className="font-bold text-sm">Talking Avatar</p>
                    <p className="text-xs text-white/70">Face-to-face with voice</p>
                  </div>
                </button>
                <button onClick={startChat}
                  className="w-full max-w-xs flex items-center gap-4 px-5 py-4 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-xl transition-all">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0"><MessageSquare size={20} /></div>
                  <div className="text-left">
                    <p className="font-bold text-sm">Text Chat</p>
                    <p className="text-xs text-white/70">Quick and simple</p>
                  </div>
                </button>
              </div>
            )}

            {/* ── Loading Avatar ── */}
            {mode === 'loading-avatar' && (
              <div className="flex-1 flex items-center justify-center gap-3">
                <Loader2 size={28} className="animate-spin text-cyan-400" />
                <p className="text-white text-sm">Starting avatar...</p>
              </div>
            )}

            {/* ── Error ── */}
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

            {/* ── Avatar Mode ── */}
            {mode === 'avatar' && embedUrl && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Avatar video with subtitle overlay */}
                <div className="h-[220px] shrink-0 bg-black relative">
                  <iframe src={embedUrl}
                    className="w-full h-full border-0"
                    allow="microphone; camera; autoplay"
                    title="FY Intech Avatar" />
                  {/* Subtitle bar overlay at bottom of video */}
                  {subtitleText && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-3 pt-10 pointer-events-none">
                      <p className="text-white text-sm leading-relaxed text-center drop-shadow-lg">
                        {subtitleText}
                      </p>
                    </div>
                  )}
                </div>

                <div className="h-px bg-gray-700 shrink-0" />

                {/* Transcript + input */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="px-3 py-1.5 bg-gray-900 border-b border-gray-800 shrink-0">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Transcript</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {messages.map((msg, i) => (
                      <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                          <div className="w-6 h-6 rounded-full bg-cyan-600 flex items-center justify-center flex-shrink-0 mt-0.5"><Bot size={12} className="text-white" /></div>
                        )}
                        <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                          msg.role === 'user' ? 'bg-cyan-600/20 text-white rounded-br-md border border-cyan-500/20' : 'bg-gray-800 text-gray-100 rounded-bl-md'
                        }`}>{msg.text}</div>
                        {msg.role === 'user' && (
                          <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0 mt-0.5"><User size={12} className="text-white" /></div>
                        )}
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex gap-2 justify-start">
                        <div className="w-6 h-6 rounded-full bg-cyan-600 flex items-center justify-center flex-shrink-0 mt-0.5"><Bot size={12} className="text-white" /></div>
                        <div className="bg-gray-800 text-gray-400 px-3 py-2 rounded-2xl rounded-bl-md text-sm"><span className="animate-pulse">Thinking...</span></div>
                      </div>
                    )}
                    <div ref={endRef} />
                  </div>
                  <div className="border-t border-gray-800 p-2 shrink-0 flex gap-2">
                    <input type="text" value={input} onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendChat()}
                      placeholder="Type your question..." className="flex-1 bg-gray-800 text-white text-xs rounded-xl px-3 py-2 outline-none border border-gray-700 focus:border-cyan-500 placeholder-gray-500" />
                    <button onClick={sendChat} disabled={chatLoading || !input.trim()}
                      className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-xl px-3 py-2 transition-colors"><Send size={14} /></button>
                  </div>
                </div>

                <p className="text-gray-500 text-[10px] text-center py-0.5 shrink-0 bg-gray-900">Sandbox — ~1 min</p>
              </div>
            )}

            {/* ── Text Chat Mode ── */}
            {mode === 'chat' && (
              <TextChat onClose={() => setMode('choose')} />
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default LiveAvatarWidget;
