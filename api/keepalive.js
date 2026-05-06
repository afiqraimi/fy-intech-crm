/**
 * Vercel Cron Function: /api/keepalive
 * Pings the Render backend every 14 minutes to prevent cold starts.
 * Schedule is defined in vercel.json (every 14 minutes)
 */
export default async function handler(req, res) {
  const BACKEND_URL = process.env.VITE_API_URL || process.env.BACKEND_URL;

  if (!BACKEND_URL) {
    return res.status(200).json({ ok: false, message: 'No BACKEND_URL configured — skipping ping.' });
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (response.ok) {
      const data = await response.json();
      console.log('[Keepalive] Backend is awake:', data);
      return res.status(200).json({ ok: true, backend: data, pingedAt: new Date().toISOString() });
    } else {
      return res.status(200).json({ ok: false, status: response.status });
    }
  } catch (error) {
    console.warn('[Keepalive] Backend ping failed:', error.message);
    return res.status(200).json({ ok: false, error: error.message });
  }
}
