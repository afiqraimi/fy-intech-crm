import React, { useState, useRef, useCallback } from 'react';
import { MessageCircle, X, Loader2, AlertTriangle } from 'lucide-react';
import { LiveAvatarSession } from '@heygen/liveavatar-web-sdk';

const API_BASE = import.meta.env.VITE_API_URL || '';

function LiveAvatarWidget() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('closed'); // closed | loading | avatar | error
  const [error, setError] = useState('');
  const sessionRef = useRef(null);
  const containerRef = useRef(null);

  const startAvatar = useCallback(async () => {
    setMode('loading');
    setError('');

    try {
      // Step 1: Get session token from our backend
      const res = await fetch(`${API_BASE}/api/public/avatar-token`, {
        method: 'POST',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to start avatar session');
      }

      const data = await res.json();

      // Step 2: Start the LiveAvatar session with the token
      const session = new LiveAvatarSession(data.session_token, {
        voiceChat: true,
      });

      session.on('ready', () => {
        console.log('[LiveAvatar] Session ready');
      });

      session.on('error', (err) => {
        console.error('[LiveAvatar] Error:', err);
        setError('Avatar connection lost. Please try again.');
        setMode('error');
      });

      session.on('disconnected', () => {
        console.log('[LiveAvatar] Session ended');
        sessionRef.current = null;
        if (mode !== 'closed') {
          setMode('closed');
          setOpen(false);
        }
      });

      await session.start();
      sessionRef.current = session;
      setMode('avatar');

      // Sandbox sessions auto-end after ~1 minute
      setTimeout(() => {
        if (sessionRef.current) {
          session.stop().catch(() => {});
          sessionRef.current = null;
          setMode('closed');
          setOpen(false);
        }
      }, 55000);
    } catch (err) {
      console.error('[LiveAvatar] Start failed:', err);
      setError(err.message || 'Could not start avatar. Try again later.');
      setMode('error');
    }
  }, []);

  const stopAvatar = useCallback(async () => {
    if (sessionRef.current) {
      try {
        await sessionRef.current.stop();
      } catch {
        // session already ended
      }
      sessionRef.current = null;
    }
    setMode('closed');
    setOpen(false);
  }, []);

  const handleOpen = () => {
    setOpen(true);
    setMode('closed');
    setError('');
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
                <MessageCircle size={18} />
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
          <div ref={containerRef} className="flex-1 flex flex-col items-center justify-center p-4 bg-gray-950 relative overflow-hidden">
            {mode === 'loading' && (
              <div className="flex flex-col items-center gap-3 text-center">
                <Loader2 size={40} className="animate-spin text-cyan-400" />
                <p className="text-white text-sm font-medium">Starting avatar...</p>
                <p className="text-gray-400 text-xs">This may take a few seconds</p>
              </div>
            )}

            {mode === 'error' && (
              <div className="flex flex-col items-center gap-3 text-center max-w-xs">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle size={24} className="text-red-400" />
                </div>
                <p className="text-white text-sm font-medium">Connection Issue</p>
                <p className="text-gray-400 text-xs">{error}</p>
                <button
                  onClick={() => setMode('closed')}
                  className="mt-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
                >
                  Try Text Chat Instead
                </button>
              </div>
            )}

            {mode === 'avatar' && (
              <div className="w-full h-full flex flex-col items-center justify-center">
                {/* The LiveAvatar SDK renders the avatar video into the DOM */}
                {/* We need a container div for it */}
                <div id="liveavatar-container" className="w-full h-full" />
                <p className="text-gray-500 text-[10px] mt-2">
                  Sandbox mode — sessions last ~1 minute
                </p>
              </div>
            )}

            {mode === 'closed' && (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center">
                  <MessageCircle size={32} className="text-cyan-400" />
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
