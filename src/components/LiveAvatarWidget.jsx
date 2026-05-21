import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MessageCircle, X, Loader2, AlertTriangle, Volume2, Bot, User, MessageSquare } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ─── Text Chat ──
function TextChat() {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi! I'm FY Intech's AI assistant. Ask me anything!" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const sessionId = useRef('visitor-' + Date.now());
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/public/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
            {msg.role === 'assistant' && <div className="w-7 h-7 rounded-full bg-cyan-600 flex items-center justify-center flex-shrink-0 mt-1"><Bot size={14} className="text-white" /></div>}
            <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-cyan-600 text-white rounded-br-md' : 'bg-gray-800 text-gray-100 rounded-bl-md'}`}>{msg.text}</div>
            {msg.role === 'user' && <div className="w-7 h-7 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0 mt-1"><User size={14} className="text-white" /></div>}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2 justify-start">
            <div className="w-7 h-7 rounded-full bg-cyan-600 flex items-center justify-center flex-shrink-0 mt-1"><Bot size={14} className="text-white" /></div>
            <div className="bg-gray-800 text-gray-400 px-4 py-2 rounded-2xl rounded-bl-md text-sm"><span className="animate-pulse">Thinking...</span></div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="border-t border-gray-700 p-3 flex gap-2 shrink-0">
        <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask about our VR solutions..." className="flex-1 bg-gray-800 text-white text-sm rounded-xl px-4 py-2.5 outline-none border border-gray-700 focus:border-cyan-500 placeholder-gray-500" />
        <button onClick={send} disabled={loading || !input.trim()}
          className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-xl px-3 py-2.5 transition-colors"><Send size={18} /></button>
      </div>
    </div>
  );
}

// ─── Main Widget ──
function LiveAvatarWidget() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('choose');
  const [error, setError] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [messages, setMessages] = useState([]);
  const [speechActive, setSpeechActive] = useState(false);
  const endRef = useRef(null);
  const sessionId = useRef('visitor-' + Date.now());
  const recognitionRef = useRef(null);
  const chatLoadingRef = useRef(false);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Start speech recognition
  const startSpeech = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser.');
      setMode('error');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = async (event) => {
      let finalText = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript;
        } else {
          interimText += event.results[i][0].transcript;
        }
      }

      // Show interim text
      if (interimText) {
        setMessages(prev => {
          const copy = [...prev];
          if (copy.length > 0 && copy[copy.length-1]?.role === 'user' && !copy[copy.length-1]?.final) {
            copy[copy.length-1] = { role: 'user', text: interimText, final: false };
          } else {
            copy.push({ role: 'user', text: interimText, final: false });
          }
          return copy;
        });
      }

      // Send final text to chatbot
      if (finalText && !chatLoadingRef.current) {
        chatLoadingRef.current = true;
        // Mark previous as final
        setMessages(prev => {
          const copy = [...prev];
          if (copy.length > 0 && copy[copy.length-1]?.role === 'user') {
            copy[copy.length-1] = { ...copy[copy.length-1], text: finalText, final: true };
          }
          return copy;
        });

        try {
          const res = await fetch(`${API_BASE}/api/public/chat`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: finalText, session_id: sessionId.current }),
          });
          const data = await res.json();
          setMessages(prev => [...prev, { role: 'assistant', text: data.reply, final: true }]);
        } catch {
          setMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, having trouble.', final: true }]);
        }
        chatLoadingRef.current = false;
      }
    };

    recognition.onerror = (e) => {
      console.error('Speech error:', e.error);
      if (e.error === 'not-allowed') {
        setError('Microphone access denied. Please allow mic access.');
        setMode('error');
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setSpeechActive(true);
  }, []);

  // Stop speech
  const stopSpeech = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setSpeechActive(false);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => { stopSpeech(); };
  }, [stopSpeech]);

  const startAvatar = useCallback(async () => {
    setMode('loading');
    setError('');
    setEmbedUrl('');
    setMessages([]);

    try {
      const res = await fetch(`${API_BASE}/api/public/avatar-embed`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json().catch(()=>({}))).detail || 'Failed');
      const data = await res.json();
      setEmbedUrl(data.url);
      setMode('avatar');
      // Start speech recognition for transcript
      startSpeech();
    } catch (err) {
      setError(err.message);
      setMode('error');
    }
  }, [startSpeech]);

  const startChat = useCallback(() => { setMode('chat'); }, []);

  const handleClose = useCallback(() => {
    stopSpeech();
    setEmbedUrl('');
    setMessages([]);
    setMode('choose');
    setOpen(false);
  }, [stopSpeech]);

  return (
    <>
      {!open && (
        <button onClick={() => { setOpen(true); setMode('choose'); setError(''); }}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg hover:shadow-xl hover:scale-110 transition-all flex items-center justify-center">
          <MessageCircle size={24} />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[420px] h-[560px] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-700 text-white shrink-0">
            <div className="flex items-center gap-2">
              {mode === 'chat' ? <MessageSquare size={18} /> : <Volume2 size={18} />}
              <span className="font-semibold text-sm">{mode === 'chat' ? 'Text Chat' : 'FY Intech Assistant'}</span>
            </div>
            <button onClick={handleClose} className="hover:bg-white/20 p-1 rounded-lg"><X size={20} /></button>
          </div>

          <div className="flex-1 flex flex-col bg-gray-950 overflow-hidden">
            {mode === 'choose' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
                <div className="text-center mb-2">
                  <p className="text-white text-base font-bold mb-1">How can I help you?</p>
                  <p className="text-gray-400 text-xs">Choose your preferred way to chat</p>
                </div>
                <button onClick={startAvatar}
                  className="w-full max-w-xs flex items-center gap-4 px-5 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl transition-all shadow-lg">
                  <Volume2 size={20} />
                  <div className="text-left"><p className="font-bold text-sm">Talking Avatar</p><p className="text-xs text-white/70">Voice + auto transcript</p></div>
                </button>
                <button onClick={startChat}
                  className="w-full max-w-xs flex items-center gap-4 px-5 py-4 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-xl transition-all">
                  <MessageSquare size={20} />
                  <div className="text-left"><p className="font-bold text-sm">Text Chat</p><p className="text-xs text-white/70">Quick and simple</p></div>
                </button>
              </div>
            )}

            {mode === 'loading' && (
              <div className="flex-1 flex items-center justify-center gap-3">
                <Loader2 size={28} className="animate-spin text-cyan-400" />
                <p className="text-white text-sm">Starting...</p>
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

            {mode === 'avatar' && embedUrl && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Avatar video */}
                <div className="h-[180px] shrink-0 bg-black">
                  <iframe src={embedUrl}
                    className="w-full h-full border-0"
                    allow="microphone; camera; autoplay"
                    title="FY Intech Avatar" />
                </div>
                <div className="h-px bg-gray-700 shrink-0" />

                {/* Auto speech transcript */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="px-3 py-1.5 bg-gray-900 border-b border-gray-800 shrink-0 flex items-center gap-2">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Conversation transcript</p>
                    {speechActive && (
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" title="Listening" />
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {messages.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-gray-500 text-xs gap-2">
                        <Volume2 size={24} className="opacity-30" />
                        <p>Speak now — your words and AI responses</p>
                        <p>will appear here automatically</p>
                        {speechActive && <p className="text-green-400 text-[10px] animate-pulse">Listening...</p>}
                      </div>
                    )}
                    {messages.map((msg, i) => (
                      <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && <div className="w-6 h-6 rounded-full bg-cyan-600 flex items-center justify-center flex-shrink-0 mt-0.5"><Bot size={12} className="text-white" /></div>}
                        <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-cyan-600/20 text-white rounded-br-md border border-cyan-500/20' : 'bg-gray-800 text-gray-100 rounded-bl-md'}`}>{msg.text}</div>
                        {msg.role === 'user' && <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0 mt-0.5"><User size={12} className="text-white" /></div>}
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
