import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MessageCircle, X, Loader2, AlertTriangle, Volume2, Send, Bot, User } from 'lucide-react';
import { LiveAvatarSession, SessionEvent, AgentEventsEnum } from '@heygen/liveavatar-web-sdk';

const API_BASE = import.meta.env.VITE_API_URL || '';

function LiveAvatarWidget() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('closed'); // closed | loading | avatar | error
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);
  const containerRef = useRef(null);
  const sessionRef = useRef(null);
  const sessionId = useRef('visitor-' + Date.now());
  const subtitleTimer = useRef(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup session on unmount
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        try { sessionRef.current.stop(); } catch {}
        sessionRef.current = null;
      }
    };
  }, []);

  const startAvatar = useCallback(async () => {
    setMode('loading');
    setError('');
    setMessages([{ role: 'assistant', text: "Hi! I'm FY Intech's AI assistant. Ask me about our VR/AR solutions, past projects, or live CRM data!" }]);

    // Clean up any previous session
    if (sessionRef.current) {
      try { sessionRef.current.stop(); } catch {}
      sessionRef.current = null;
    }

    try {
      // 1. Get session token from backend
      const res = await fetch(`${API_BASE}/api/public/avatar-token`, {
        method: 'POST',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to start avatar');
      }

      const data = await res.json();

      // 2. Create SDK session
      const session = new LiveAvatarSession(data.session_token, {
        voiceChat: true,
      });

      // ── SDK Event Listeners ──

      // When avatar starts speaking, show text
      session.on(AgentEventsEnum.AVATAR_TRANSCRIPTION, (payload) => {
        if (payload && payload.text) {
          // Add/update the last assistant message with the transcription
          setMessages(prev => {
            const copy = [...prev];
            // If the last message is already assistant, update it
            if (copy.length > 0 && copy[copy.length - 1].role === 'assistant' && !copy[copy.length - 1].final) {
              copy[copy.length - 1] = { role: 'assistant', text: payload.text, final: false };
            } else {
              copy.push({ role: 'assistant', text: payload.text, final: false });
            }
            return copy;
          });
        }
      });

      // Transcription chunks for real-time updates
      session.on(AgentEventsEnum.AVATAR_TRANSCRIPTION_CHUNK, (payload) => {
        if (payload && payload.text) {
          setMessages(prev => {
            const copy = [...prev];
            if (copy.length > 0 && copy[copy.length - 1].role === 'assistant' && !copy[copy.length - 1].final) {
              copy[copy.length - 1] = { role: 'assistant', text: payload.text, final: false };
            } else {
              copy.push({ role: 'assistant', text: payload.text, final: false });
            }
            return copy;
          });
        }
      });

      // Mark transcription as final when avatar stops speaking
      session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
        setMessages(prev => {
          const copy = [...prev];
          if (copy.length > 0 && copy[copy.length - 1].role === 'assistant') {
            copy[copy.length - 1] = { ...copy[copy.length - 1], final: true };
          }
          return copy;
        });
      });

      // User transcription (what user said)
      session.on(AgentEventsEnum.USER_TRANSCRIPTION, (payload) => {
        if (payload && payload.text) {
          setMessages(prev => {
            const copy = [...prev];
            if (copy.length > 0 && copy[copy.length - 1].role === 'user' && !copy[copy.length - 1].final) {
              copy[copy.length - 1] = { role: 'user', text: payload.text, final: false };
            } else {
              copy.push({ role: 'user', text: payload.text, final: false });
            }
            return copy;
          });
        }
      });

      // When stream is ready (video + audio), attach to our container
      session.on(SessionEvent.SESSION_STREAM_READY, () => {
        if (containerRef.current) {
          const videoEl = document.createElement('video');
          videoEl.style.width = '100%';
          videoEl.style.height = '100%';
          videoEl.style.objectFit = 'cover';
          videoEl.setAttribute('playsinline', '');
          videoEl.setAttribute('autoplay', '');
          containerRef.current.appendChild(videoEl);
          session.attach(videoEl);
          setMode('avatar');
        }
      });

      // Session ended
      session.on(SessionEvent.SESSION_DISCONNECTED, () => {
        sessionRef.current = null;
        if (containerRef.current) containerRef.current.innerHTML = '';
        // Only reset if we're not already closed
        setMode(prev => prev === 'avatar' ? 'closed' : prev);
      });

      // 3. Start the session
      const startPromise = session.start();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out. Please try again.')), 20000)
      );
      await Promise.race([startPromise, timeoutPromise]);
      sessionRef.current = session;

      // Sandbox auto-end timer
      setTimeout(() => {
        if (sessionRef.current) {
          try { session.stop(); } catch {}
          sessionRef.current = null;
          if (containerRef.current) containerRef.current.innerHTML = '';
          setMode('closed');
        }
      }, 55000);

    } catch (err) {
      console.error('[LiveAvatar] Error:', err);
      if (containerRef.current) containerRef.current.innerHTML = '';
      setError(err.message || 'Could not start avatar.');
      setMode('error');
    }
  }, []);

  const stopAvatar = useCallback(() => {
    if (sessionRef.current) {
      try { sessionRef.current.stop(); } catch {}
      sessionRef.current = null;
    }
    if (containerRef.current) containerRef.current.innerHTML = '';
    setMessages([]);
    setMode('closed');
    setOpen(false);
  }, []);

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
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, having trouble. Email ask@fyintech.com for help!', final: true }]);
    }
    setChatLoading(false);
  }, [input, chatLoading]);

  const handleOpen = () => {
    setOpen(true);
    setMode('closed');
    setError('');
    setMessages([]);
  };

  const handleClose = () => {
    stopAvatar();
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button onClick={handleOpen}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg hover:shadow-xl hover:scale-110 transition-all flex items-center justify-center"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* Widget */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[420px] h-[560px] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-700 text-white shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"><Volume2 size={18} /></div>
              <div>
                <div className="font-semibold text-sm">FY Intech Assistant</div>
                <div className="text-xs text-white/70">Voice + text chat</div>
              </div>
            </div>
            <button onClick={handleClose} className="hover:bg-white/20 p-1 rounded-lg transition-colors"><X size={20} /></button>
          </div>

          {/* Body */}
          <div className="flex-1 flex flex-col bg-gray-950 overflow-hidden">
            {mode === 'loading' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
                <Loader2 size={40} className="animate-spin text-cyan-400" />
                <p className="text-white text-sm font-medium">Starting avatar...</p>
              </div>
            )}

            {mode === 'error' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center max-w-xs mx-auto p-4">
                <AlertTriangle size={24} className="text-red-400" />
                <p className="text-white text-sm font-medium">Connection Issue</p>
                <p className="text-gray-400 text-xs">{error}</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={startAvatar} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white text-sm">Try Again</button>
                  <button onClick={() => { setMode('closed'); }} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm">Close</button>
                </div>
              </div>
            )}

            {mode === 'avatar' && (
              <div className="flex-1 flex flex-col">
                {/* Video area */}
                <div ref={containerRef} className="h-[200px] shrink-0 bg-black" />

                <div className="h-px bg-gray-700 shrink-0" />

                {/* Transcript panel */}
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
                          msg.role === 'user'
                            ? 'bg-cyan-600/20 text-white rounded-br-md border border-cyan-500/20'
                            : 'bg-gray-800 text-gray-100 rounded-bl-md'
                        }`}>
                          {msg.text}
                        </div>
                        {msg.role === 'user' && (
                          <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0 mt-0.5"><User size={12} className="text-white" /></div>
                        )}
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex gap-2 justify-start">
                        <div className="w-6 h-6 rounded-full bg-cyan-600 flex items-center justify-center flex-shrink-0 mt-0.5"><Bot size={12} className="text-white" /></div>
                        <div className="bg-gray-800 text-gray-400 px-3 py-2 rounded-2xl rounded-bl-md text-sm"><span className="animate-pulse">Typing...</span></div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Chat input */}
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

            {mode === 'closed' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-4">
                <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center"><Volume2 size={32} className="text-cyan-400" /></div>
                <div>
                  <p className="text-white text-sm font-medium mb-1">Talk to our AI assistant</p>
                  <p className="text-gray-400 text-xs">VR/AR solutions, live CRM data, projects, and more!</p>
                </div>
                <button onClick={startAvatar} className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-cyan-500/20">Start Talking</button>
                <p className="text-gray-500 text-[10px]">Free preview — 1 minute</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default LiveAvatarWidget;
