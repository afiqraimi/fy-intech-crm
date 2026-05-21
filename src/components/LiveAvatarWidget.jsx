import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MessageCircle, X, Loader2, AlertTriangle, Volume2, Bot, User, MessageSquare } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ─── Text Chat ──
function TextChat({ embedded, onSendRef }) {
  const [messages, setMessages] = useState(
    embedded ? [] : [{ role: 'assistant', text: "Hi! I'm FY Intech's AI assistant. Ask me anything!" }]
  );
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const sid = useRef('v-' + Date.now());

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (onSendRef) onSendRef.current = send; }, [onSendRef]);

  const send = async (text) => {
    if (!text || loading) return;
    setMessages(p => [...p, { role: 'user', text }]);
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/public/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, session_id: sid.current }) });
      const d = await r.json();
      setMessages(p => [...p, { role: 'assistant', text: d.reply }]);
    } catch { setMessages(p => [...p, { role: 'assistant', text: 'Sorry!' }]); }
    setLoading(false);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && !embedded && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 text-xs gap-2"><Volume2 size={24} className="opacity-30" /><p>Type a message to start the conversation</p></div>
        )}
        {messages.length === 0 && embedded && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 text-xs gap-2"><Volume2 size={24} className="opacity-30" /><p>Speak to the avatar or type below</p></div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && <div className="w-6 h-6 rounded-full bg-cyan-600 flex items-center justify-center flex-shrink-0 mt-0.5"><Bot size={12} /></div>}
            <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${m.role === 'user' ? 'bg-cyan-600/20 text-white rounded-br-md border border-cyan-500/20' : 'bg-gray-800 text-gray-100 rounded-bl-md'}`}>{m.text}</div>
            {m.role === 'user' && <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0 mt-0.5"><User size={12} /></div>}
          </div>
        ))}
        {loading && <div className="flex gap-2 justify-start"><div className="w-6 h-6 rounded-full bg-cyan-600 flex items-center justify-center flex-shrink-0 mt-0.5"><Bot size={12} /></div><div className="bg-gray-800 text-gray-400 px-3 py-2 rounded-2xl rounded-bl-md text-sm"><span className="animate-pulse">Thinking...</span></div></div>}
        <div ref={endRef} />
      </div>
      {!embedded && (
        <div className="border-t border-gray-700 p-3 flex gap-2 shrink-0">
          <input type="text" id="chat-input" placeholder="Ask..." className="flex-1 bg-gray-800 text-white text-sm rounded-xl px-4 py-2.5 outline-none border border-gray-700 focus:border-cyan-500 placeholder-gray-500" />
          <button className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-xl px-3 py-2.5 transition-colors"><MessageCircle size={18} /></button>
        </div>
      )}
    </div>
  );
}

// ─── Main ──
function LiveAvatarWidget() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('choose');
  const [error, setError] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [isListening, setIsListening] = useState(false);
  const sendRef = useRef(null);
  const recogRef = useRef(null);
  const transcriptRef = useRef('');

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { return; }
    
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';
    
    r.onresult = (e) => {
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
      }
      if (final && sendRef.current) {
        sendRef.current(final);
      }
    };
    
    r.onerror = () => {};
    r.onend = () => setIsListening(false);
    
    r.start();
    recogRef.current = r;
    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    if (recogRef.current) { try { recogRef.current.stop(); } catch {} recogRef.current = null; }
    setIsListening(false);
  }, []);

  useEffect(() => () => { stopListening(); }, [stopListening]);

  const startAvatar = useCallback(async () => {
    setMode('loading');
    setError('');
    setEmbedUrl('');
    stopListening();
    try {
      const res = await fetch(`${API_BASE}/api/public/avatar-embed`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json().catch(()=>({}))).detail || 'Failed');
      const data = await res.json();
      setEmbedUrl(data.url);
      setMode('avatar');
      startListening();
    } catch (err) {
      setError(err.message);
      setMode('error');
    }
  }, [startListening, stopListening]);

  const startChat = useCallback(() => setMode('chat'), []);

  const handleClose = useCallback(() => {
    stopListening();
    setEmbedUrl('');
    setMode('choose');
    setOpen(false);
  }, [stopListening]);

  return (
    <>
      {!open && <button onClick={() => { setOpen(true); setMode('choose'); setError(''); }} className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg hover:shadow-xl hover:scale-110 transition-all flex items-center justify-center"><MessageCircle size={24} /></button>}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[420px] h-[560px] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-700 text-white shrink-0">
            <Volume2 size={18} /><span className="font-semibold text-sm flex-1">{mode === 'chat' ? 'Text Chat' : 'FY Intech Assistant'}</span>
            <button onClick={handleClose} className="hover:bg-white/20 p-1 rounded-lg"><X size={20} /></button>
          </div>

          <div className="flex-1 flex flex-col bg-gray-950 overflow-hidden">
            {mode === 'choose' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
                <p className="text-white text-base font-bold mb-1">How can I help you?</p>
                <button onClick={startAvatar} className="w-full max-w-xs flex items-center gap-4 px-5 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl shadow-lg"><Volume2 size={20} /><div className="text-left"><p className="font-bold text-sm">Talking Avatar</p><p className="text-xs text-white/70">Voice + live transcript</p></div></button>
                <button onClick={startChat} className="w-full max-w-xs flex items-center gap-4 px-5 py-4 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-xl"><MessageSquare size={20} /><div className="text-left"><p className="font-bold text-sm">Text Chat</p><p className="text-xs text-white/70">Quick and simple</p></div></button>
              </div>
            )}

            {mode === 'loading' && (
              <div className="flex-1 flex items-center justify-center gap-3">
                <Loader2 size={28} className="animate-spin text-cyan-400" />
                <p className="text-white text-sm">Starting avatar...</p>
              </div>
            )}

            {mode === 'error' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center max-w-xs mx-auto p-4">
                <AlertTriangle size={24} className="text-red-400" />
                <p className="text-white text-sm">{error}</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={startAvatar} className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-semibold">Try Again</button>
                  <button onClick={() => setMode('choose')} className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm">Back</button>
                </div>
              </div>
            )}

            {mode === 'avatar' && embedUrl && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="h-[180px] shrink-0 bg-black relative">
                  <iframe src={embedUrl} className="w-full h-full border-0" allow="microphone; camera; autoplay" title="FY Intech Avatar" />
                  {isListening && <div className="absolute top-2 right-2 flex items-center gap-1 bg-green-600/80 text-white text-[10px] px-2 py-0.5 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Listening</div>}
                </div>
                <div className="h-px bg-gray-700 shrink-0" />
                <TextChat embedded={true} onSendRef={sendRef} />
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
