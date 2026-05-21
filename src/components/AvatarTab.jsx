import React, { useState, useCallback } from 'react';
import { Volume2, Loader2, AlertTriangle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function AvatarTab() {
  const [state, setState] = useState('idle'); // idle | loading | active | error
  const [error, setError] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');

  const startAvatar = useCallback(async () => {
    setState('loading');
    setError('');
    setEmbedUrl('');
    try {
      const res = await fetch(`${API_BASE}/api/public/avatar-embed`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json().catch(()=>({}))).detail || 'Failed');
      const data = await res.json();
      setEmbedUrl(data.url);
      setState('active');
    } catch (err) {
      setError(err.message);
      setState('error');
    }
  }, []);

  return (
    <div className="flex flex-col h-full">
      {state === 'idle' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center border border-cyan-500/30">
            <Volume2 size={40} className="text-cyan-400" />
          </div>
          <div className="text-center max-w-md">
            <h3 className="text-white text-xl font-bold mb-2">AI Avatar Assistant</h3>
            <p className="text-crm-textMuted text-sm leading-relaxed">
              Start a conversation with a realistic AI avatar. Speak naturally — the avatar will listen and respond with voice.
            </p>
          </div>
          <button
            onClick={startAvatar}
            className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/20 text-base"
          >
            Start Avatar Session
          </button>
          <p className="text-crm-textMuted text-xs">Sandbox mode — sessions last about 1 minute</p>
        </div>
      )}

      {state === 'loading' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full bg-cyan-500/20 animate-ping" />
            <div className="absolute inset-3 rounded-full bg-cyan-500/30 flex items-center justify-center">
              <Loader2 size={30} className="animate-spin text-cyan-400" />
            </div>
          </div>
          <p className="text-white text-base font-medium">Connecting to avatar...</p>
          <p className="text-crm-textMuted text-xs">This takes about 5-10 seconds</p>
        </div>
      )}

      {state === 'active' && embedUrl && (
        <div className="rounded-2xl overflow-hidden border border-crm-border/50 bg-black h-[calc(100vh-220px)]">
          <iframe
            src={embedUrl}
            className="w-full h-full border-0"
            allow="microphone; camera; autoplay"
            title="FY Intech Avatar"
          />
        </div>
      )}

      {state === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center max-w-sm mx-auto">
          <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertTriangle size={28} className="text-red-400" />
          </div>
          <p className="text-white font-bold text-lg">Connection Issue</p>
          <p className="text-crm-textMuted text-sm">{error}</p>
          <button
            onClick={startAvatar}
            className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
