/**
 * Reads SMTP settings from localStorage and fires a notification email.
 * Call this after any significant CRM action if notifications are enabled.
 */
export async function sendCrmNotification(subject, body) {
  try {
    const prefs = JSON.parse(localStorage.getItem('crm_prefs') || '{}');

    // Only send if the user has enabled notifications AND configured SMTP
    if (!prefs.notifications || !prefs.notifEmail || !prefs.notifSmtp || !prefs.notifPassword) {
      return; // Silently skip — notifications not configured
    }

    await fetch(`${import.meta.env.VITE_API_URL || "http://" + window.location.hostname + ":8000"}/api/send-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to_emails: prefs.notifEmail.split(',').map(e => e.trim()),
        smtp_email: prefs.notifSmtp,
        smtp_password: prefs.notifPassword,
        subject: `FY Intech CRM — ${subject}`,
        body,
      }),
    });
  } catch (e) {
    // Fail silently — never block the UI because of a notification error
    console.warn('CRM notification failed:', e);
  }
}
