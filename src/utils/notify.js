/**
 * Reads notification settings from localStorage and fires a notification email via Resend.
 * The RESEND_API_KEY lives in Vercel environment variables — never in the browser.
 * Call this after any significant CRM action if notifications are enabled.
 */
export async function sendCrmNotification(subject, body) {
  try {
    const prefs = JSON.parse(localStorage.getItem('crm_prefs') || '{}');

    // Only send if the user has enabled notifications AND configured a recipient
    if (!prefs.notifications || !prefs.notifEmail) {
      return; // Silently skip — notifications not configured
    }

    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to_emails: prefs.notifEmail.split(',').map(e => e.trim()),
        subject: `FY Intech CRM — ${subject}`,
        body,
      }),
    });
  } catch (e) {
    // Fail silently — never block the UI because of a notification error
    console.warn('CRM notification failed:', e);
  }
}
