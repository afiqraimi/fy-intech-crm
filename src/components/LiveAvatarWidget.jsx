import React, { useState, useCallback } from 'react';
import { MessageCircle, X, Loader2, AlertTriangle, Volume2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

function LiveAvatarWidget() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('closed'); // closed | loading | avatar | error
  const [error, setError] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');

  const startAvatar = useCallback(async () => {
    setMode('loading');
    setError('');

    try {
      // Get embed URL from backend (which proxies the LiveAvatar API)
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
    } catch (err) {
      console.error('[LiveAvatar] Start failed:', err);
      setMode('error');
      setError(err.message || 'Could not start avatar. Please try again.');
    }
  }, []);

  const stopAvatar = useCallback(() => {
    setEmbedUrl('');
    setMode('closed');
    setOpen(false);
  }, []);

  const handleOpen = () => {
    setOpen(true);
    setMode('closed');
    setError('');
    setEmbedUrl('');
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
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[500px] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-700 text-white shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Volume2 size={18} />
              </div>
              <div>
                <div className="font-semibold text-sm">FY Intech Assistant</div>
                <div className="text-xs text-white/70">AI-powered avatar</div>
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
          <div className="flex-1 flex flex-col bg-gray-950 relative overflow-hidden">
            {mode === 'loading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-4">
                <Loader2 size={40} className="animate-spin text-cyan-400" />
                <p className="text-white text-sm font-medium">Starting avatar...</p>
                <p className="text-gray-400 text-xs">Please wait a moment</p>
              </div>
            )}

            {mode === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center max-w-xs mx-auto p-4">
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
                <div className="flex-1 bg-black">
                  <iframe
                    src={embedUrl}
                    className="w-full h-full border-0"
                    allow="microphone; camera; autoplay"
                    title="FY Intech Avatar"
                  />
                </div>
                <p className="text-gray-500 text-[10px] text-center py-1 shrink-0">
                  Sandbox mode — ~1 min per session
                </p>
              </div>
            )}

            {mode === 'closed' && !embedUrl && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-4">
                <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center">
                  <Volume2 size={32} className="text-cyan-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium mb-1">
                    Talk to our AI assistant
                  </p>
                  <p className="text-gray-400 text-xs">
                    Ask about our VR/AR solutions, past projects, or how we can help your business!
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
