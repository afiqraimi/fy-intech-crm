import React, { useState, useRef, useCallback, useEffect } from 'react';
import { MessageCircle, X, Loader2, AlertTriangle, Volume2 } from 'lucide-react';
import { LiveAvatarSession, SessionEvent, AgentEventsEnum } from '@heygen/liveavatar-web-sdk';

const API_BASE = import.meta.env.VITE_API_URL || '';

function LiveAvatarWidget() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('closed'); // closed | loading | avatar | error
  const [error, setError] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const sessionRef = useRef(null);
  const containerRef = useRef(null);
  const videoRef = useRef(null);

  // Cleanup video element from container and stop old session
  const cleanupVideo = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
    videoRef.current = null;
  }, []);

  // Fully stop + cleanup an existing session
  const stopSession = useCallback(async () => {
    if (sessionRef.current) {
      try {
        sessionRef.current.removeAllListeners();
        await sessionRef.current.stop();
      } catch {
        // already ended
      }
      sessionRef.current = null;
    }
    cleanupVideo();
    setSubtitle('');
  }, [cleanupVideo]);

  const startAvatar = useCallback(async () => {
    // Clean up any existing session first
    await stopSession();
    
    setMode('loading');
    setError('');
    setSubtitle('');
    cleanupVideo();

    try {
      const res = await fetch(`${API_BASE}/api/public/avatar-token`, {
        method: 'POST',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to start avatar');
      }

      const data = await res.json();

      const session = new LiveAvatarSession(data.session_token, {
        voiceChat: true,
      });

      // Listen for avatar speech transcription (what the avatar says)
      session.on(AgentEventsEnum.AVATAR_TRANSCRIPTION, (payload) => {
        if (payload && payload.text) {
          // If it's a final transcription, replace. If chunk, append.
          setSubtitle(payload.text);
        }
      });

      session.on(AgentEventsEnum.AVATAR_TRANSCRIPTION_CHUNK, (payload) => {
        if (payload && payload.text) {
          setSubtitle(payload.text);
        }
      });

      // Clear subtitle when avatar stops speaking
      session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
        // Keep the last subtitle visible for a moment, then clear
        setTimeout(() => setSubtitle(''), 2000);
      });

      session.on(SessionEvent.SESSION_STREAM_READY, () => {
        console.log('[LiveAvatar] Stream ready');
        if (containerRef.current && !videoRef.current) {
          const videoEl = document.createElement('video');
          videoEl.style.width = '100%';
          videoEl.style.height = '100%';
          videoEl.style.objectFit = 'cover';
          videoEl.setAttribute('playsinline', '');
          videoEl.setAttribute('autoplay', '');
          videoEl.muted = false;
          containerRef.current.appendChild(videoEl);
          videoRef.current = videoEl;
          session.attach(videoEl);
          setMode('avatar');
        }
      });

      session.on(SessionEvent.SESSION_DISCONNECTED, () => {
        console.log('[LiveAvatar] Session disconnected');
        sessionRef.current = null;
        cleanupVideo();
        setSubtitle('');
        // If we disconnected during loading, show an error
        setMode(prev => {
          if (prev === 'loading') {
            setError('Session ended before it could start. Please try again.');
            return 'error';
          }
          return 'closed';
        });
      });

      // Also listen for generic error events
      session.on('session.error', (err) => {
        console.error('[LiveAvatar] Error:', err);
        setError('Connection lost. Try again.');
        setMode('error');
      });

      // Start session with a timeout (shorter timeout for retries)
      const startPromise = session.start();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out. Please check your internet and try again.')), 15000)
      );
      await Promise.race([startPromise, timeoutPromise]);
      sessionRef.current = session;
      console.log('[LiveAvatar] Session started successfully');

      // Sandbox auto-end timer
      setTimeout(() => {
        if (sessionRef.current) {
          session.stop().catch(() => {});
          sessionRef.current = null;
          cleanupVideo();
          setSubtitle('');
          setMode('closed');
        }
      }, 55000);
    } catch (err) {
      console.error('[LiveAvatar] Start failed:', err);
      sessionRef.current = null;
      cleanupVideo();
      // Show a clear error so the user knows what happened
      setError(err.message || 'Could not start avatar. Please try again.');
      setMode('error');
    }
  }, [cleanupVideo, stopSession]);

  const stopAvatar = useCallback(async () => {
    await stopSession();
    setMode('closed');
    setOpen(false);
  }, [stopSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
  }, [stopSession]);

  const handleOpen = () => {
    setOpen(true);
    setMode('closed');
    setError('');
    setSubtitle('');
    cleanupVideo();
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
                <p className="text-gray-400 text-xs">This may take a few seconds</p>
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
                    onClick={() => setMode('closed')}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {mode === 'avatar' && (
              <>
                {/* Video container */}
                <div ref={containerRef} className="flex-1 bg-black" />

                {/* Subtitle overlay at bottom of video */}
                {subtitle && (
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
                    <p className="text-white text-sm leading-relaxed text-center drop-shadow-lg">
                      {subtitle}
                    </p>
                  </div>
                )}

                {/* Sandbox badge */}
                <p className="text-gray-500 text-[10px] text-center py-1 shrink-0">
                  Sandbox mode — ~1 min per session
                </p>
              </>
            )}

            {mode === 'closed' && (
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
