import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MessageCircle, X, Loader2, AlertTriangle, Volume2, Send, Bot, User } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

function LiveAvatarWidget() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('closed'); // closed | loading | avatar | error
  const [error, setError] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);
  const sessionId = useRef('visitor-' + Date.now());

  // Auto-scroll chat when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startAvatar = useCallback(async () => {
    setMode('loading');
    setError('');
    setMessages([]);

    try {
      const res = await fetch(`${API_BASE}/api/public/avatar-embed`, {
        method: 'POST',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to start avatar');
      }

      const data = await res.json();
      setEmbedUrl(data.url);
      setMode('avatar');
      // Welcome message
      setMessages([{ role: 'assistant', text: "Hi! I'm FY Intech's AI assistant. Ask me about our VR/AR solutions, past projects, recent leads, or anything about our CRM!" }]);
    } catch (err) {
      console.error('[LiveAvatar] Start failed:', err);
      setMode('error');
      setError(err.message || 'Could not start avatar. Please try again.');
    }
  }, []);

  const stopAvatar = useCallback(() => {
    setEmbedUrl('');
    setMessages([]);
    setMode('closed');
    setOpen(false);
  }, []);

  const sendChat = useCallback(async () => {
    const text = input.trim();
    if (!text || chatLoading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setChatLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/public/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: sessionId.current }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', text: data.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, having trouble connecting. Please email ask@fyintech.com for help!' }]);
    }
    setChatLoading(false);
  }, [input, chatLoading]);

  const handleOpen = () => {
    setOpen(true);
    setMode('closed');
    setError('');
    setEmbedUrl('');
    setMessages([]);
  };

  const handleClose = () => {
    stopAvatar();
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={handleOpen}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg hover:shadow-xl hover:scale-110 transition-all flex items-center justify-center"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* Avatar window */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[420px] h-[560px] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-700 text-white shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Volume2 size={18} />
              </div>
              <div>
                <div className="font-semibold text-sm">FY Intech Assistant</div>
                <div className="text-xs text-white/70">Voice + text chat</div>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="hover:bg-white/20 p-1 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 flex flex-col bg-gray-950 overflow-hidden">
            {mode === 'loading' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-4">
                <Loader2 size={40} className="animate-spin text-cyan-400" />
                <p className="text-white text-sm font-medium">Starting avatar...</p>
                <p className="text-gray-400 text-xs">Please wait a moment</p>
              </div>
            )}

            {mode === 'error' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center max-w-xs mx-auto p-4">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle size={24} className="text-red-400" />
                </div>
                <p className="text-white text-sm font-medium">Connection Issue</p>
                <p className="text-gray-400 text-xs">{error}</p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={startAvatar}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white text-sm transition-colors"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={() => { setMode('closed'); setEmbedUrl(''); }}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {mode === 'avatar' && embedUrl && (
              <div className="flex-1 flex flex-col">
                {/* Avatar iframe (top half) */}
                <div className="h-[200px] shrink-0 bg-black">
                  <iframe
                    src={embedUrl}
                    className="w-full h-full border-0"
                    allow="microphone; camera; autoplay"
                    title="FY Intech Avatar"
                  />
                </div>

                {/* Divider */}
                <div className="h-px bg-gray-700 shrink-0" />

                {/* Transcript panel (bottom half) */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="px-3 py-1.5 bg-gray-900 border-b border-gray-800 shrink-0">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Transcript</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {messages.map((msg, i) => (
                      <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                          <div className="w-6 h-6 rounded-full bg-cyan-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Bot size={12} className="text-white" />
                          </div>
                        )}
                        <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-cyan-600/20 text-white rounded-br-md border border-cyan-500/20'
                            : 'bg-gray-800 text-gray-100 rounded-bl-md'
                        }`}>
                          {msg.text}
                        </div>
                        {msg.role === 'user' && (
                          <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <User size={12} className="text-white" />
                          </div>
                        )}
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex gap-2 justify-start">
                        <div className="w-6 h-6 rounded-full bg-cyan-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Bot size={12} className="text-white" />
                        </div>
                        <div className="bg-gray-800 text-gray-400 px-3 py-2 rounded-2xl rounded-bl-md text-sm">
                          <span className="animate-pulse">Typing...</span>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Chat input */}
                  <div className="border-t border-gray-800 p-2 shrink-0 flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendChat()}
                      placeholder="Type your question..."
                      className="flex-1 bg-gray-800 text-white text-xs rounded-xl px-3 py-2 outline-none border border-gray-700 focus:border-cyan-500 placeholder-gray-500"
                    />
                    <button
                      onClick={sendChat}
                      disabled={chatLoading || !input.trim()}
                      className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-xl px-3 py-2 transition-colors"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>

                {/* Sandbox badge */}
                <p className="text-gray-500 text-[10px] text-center py-0.5 shrink-0 bg-gray-900">
                  Sandbox mode — ~1 min per session
                </p>
              </div>
            )}

            {mode === 'closed' && !embedUrl && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-4">
                <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center">
                  <Volume2 size={32} className="text-cyan-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium mb-1">
                    Talk to our AI assistant
                  </p>
                  <p className="text-gray-400 text-xs">
                    Ask about our VR/AR solutions, past projects, live CRM data, or anything about FY Intech!
                  </p>
                </div>
                <button
                  onClick={startAvatar}
                  className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-cyan-500/20"
                >
                  Start Talking
                </button>
                <p className="text-gray-500 text-[10px]">
                  Free preview — 1 minute per session
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default LiveAvatarWidget;
