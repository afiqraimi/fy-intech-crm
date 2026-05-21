import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MessageCircle, X, Loader2, AlertTriangle, Volume2, Bot, User, MessageSquare, Send, Mic, MicOff } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ─── Text Chat Component ──────────────────────────────────────────────────
function TextChat({ embedded = false, apiBase, sessionId: extSessionId }) {
  const [messages, setMessages] = useState(
    embedded ? [] : [{ role: 'assistant', text: "Hi! I'm FY Intech's AI assistant. Ask me anything!" }]
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const sessionId = useRef(extSessionId || 'visitor-' + Date.now());

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (text) => {
    if (!text || loading) return;
    if (embedded) setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setLoading(true);
    try {
      const res = await fetch(`${apiBase || API_BASE}/api/public/chat`, {
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
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && !embedded && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 text-xs gap-2">
            <Volume2 size={24} className="opacity-30" />
            <p>Type a message to start the conversation</p>
          </div>
        )}
        {messages.length === 0 && embedded && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 text-xs gap-2">
            <Volume2 size={24} className="opacity-30" />
            <p>Speak to the avatar or type below</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && <div className="w-6 h-6 rounded-full bg-cyan-600 flex items-center justify-center flex-shrink-0 mt-0.5"><Bot size={12} className="text-white" /></div>}
            <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-cyan-600/20 text-white rounded-br-md border border-cyan-500/20' : 'bg-gray-800 text-gray-100 rounded-bl-md'}`}>{msg.text}</div>
            {msg.role === 'user' && <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0 mt-0.5"><User size={12} className="text-white" /></div>}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2 justify-start">
            <div className="w-6 h-6 rounded-full bg-cyan-600 flex items-center justify-center flex-shrink-0 mt-0.5"><Bot size={12} className="text-white" /></div>
            <div className="bg-gray-800 text-gray-400 px-3 py-2 rounded-2xl rounded-bl-md text-sm"><span className="animate-pulse">Thinking...</span></div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      {!embedded && (
        <div className="border-t border-gray-700 p-3 flex gap-2 shrink-0">
          <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send(input.trim())}
            placeholder="Ask about our VR solutions..." className="flex-1 bg-gray-800 text-white text-sm rounded-xl px-4 py-2.5 outline-none border border-gray-700 focus:border-cyan-500 placeholder-gray-500" />
          <button onClick={() => send(input.trim())} disabled={loading || !input.trim()}
            className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-xl px-3 py-2.5 transition-colors"><Send size={18} /></button>
        </div>
      )}
    </div>
  );
}

// ─── Main Widget ──────────────────────────────────────────────────────────
function LiveAvatarWidget() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('choose');
  const [error, setError] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const chatSessionId = useRef('visitor-' + Date.now());

  const startAvatar = useCallback(async () => {
    setMode('loading');
    setError('');
    setEmbedUrl('');
    try {
      const res = await fetch(`${API_BASE}/api/public/avatar-embed`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json().catch(()=>({}))).detail || 'Failed');
      const data = await res.json();
      setEmbedUrl(data.url);
      setMode('avatar');
    } catch (err) {
      setError(err.message);
      setMode('error');
    }
  }, []);

  const startChat = useCallback(() => { setMode('chat'); }, []);

  // Simple SpeechRecognition for avatar mode
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);
  const sendToChat = useRef(null);

  useEffect(() => {
    sendToChat.current = (text) => {
      // Trigger text chat's send function
      const event = new CustomEvent('speech-text', { detail: text });
      window.dispatchEvent(event);
    };
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
        recognitionRef.current = null;
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition not supported in this browser. Please type instead.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let final = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      setTranscript(final || interim);
      if (final && sendToChat.current) {
        sendToChat.current(final);
        setTranscript('');
      }
    };

    recognition.onerror = (e) => {
      console.error('Speech error:', e.error);
      if (e.error !== 'no-speech') {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }, [isListening]);

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
            <button onClick={() => { setEmbedUrl(''); setMode('choose'); setOpen(false); setIsListening(false); if(recognitionRef.current) recognitionRef.current.stop(); }} className="hover:bg-white/20 p-1 rounded-lg"><X size={20} /></button>
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
                  <div className="text-left"><p className="font-bold text-sm">Talking Avatar</p><p className="text-xs text-white/70">Face + text chat below</p></div>
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
                <div className="h-[180px] shrink-0 bg-black">
                  <iframe src={embedUrl} className="w-full h-full border-0" allow="microphone; camera; autoplay" title="FY Intech Avatar" />
                </div>
                <div className="h-px bg-gray-700 shrink-0" />
                
                {/* Transcript area */}
                <TextChat embedded={true} apiBase={API_BASE} sessionId={chatSessionId.current} />

                {/* Speech button + input */}
                <div className="border-t border-gray-800 p-2 shrink-0 flex gap-2">
                  <button onClick={toggleListening}
                    className={`p-2 rounded-xl transition-colors flex-shrink-0 ${isListening ? 'bg-green-600 text-white animate-pulse' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                    title={isListening ? 'Stop listening' : 'Start voice input'}>
                    {isListening ? <Mic size={16} /> : <MicOff size={16} />}
                  </button>
                  <input id="avatar-text-input" type="text" placeholder="Type your message..." 
                    className="flex-1 bg-gray-800 text-white text-xs rounded-xl px-3 py-2 outline-none border border-gray-700 focus:border-cyan-500 placeholder-gray-500" />
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
