/* global process */
/**
 * Vercel Serverless Function: /api/notify
 * Sends email via Resend (https://resend.com) — no SMTP, no App Password.
 * RESEND_API_KEY must be set in Vercel Environment Variables.
 */

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const NOTIFY_SECRET = process.env.NOTIFY_SECRET;
  if (NOTIFY_SECRET) {
    const authHeader = req.headers['authorization'] || '';
    if (authHeader !== `Bearer ${NOTIFY_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const { to_emails, subject, body } = req.body;

  if (!to_emails || !subject || !body) {
    return res.status(400).json({ error: 'Missing required parameters (to_emails, subject, body)' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY is not configured in Vercel environment variables.' });
  }

  const htmlBody = `
  <html><body style="font-family:Arial,sans-serif;background:#0a0a0a;color:#fff;padding:30px;">
    <div style="max-width:600px;margin:0 auto;background:#121212;border:1px solid #262626;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:30px;text-align:center;">
        <h1 style="color:#fff;font-size:22px;margin:0;">FY Intech CRM</h1>
        <p style="color:#a3a3a3;font-size:12px;margin:8px 0 0;">Intelligence Platform Notification</p>
      </div>
      <div style="padding:30px;">
        <p style="color:#e5e5e5;line-height:1.8;font-size:14px;white-space:pre-wrap;">${body}</p>
      </div>
      <div style="padding:15px 30px;border-top:1px solid #262626;text-align:center;">
        <p style="color:#525252;font-size:11px;margin:0;">FY Intech CRM &bull; Automated Notification &bull; Powered by Resend</p>
      </div>
    </div>
  </body></html>
  `;

  try {
    const recipients = Array.isArray(to_emails) ? to_emails : [to_emails];

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'FY Intech CRM <onboarding@resend.dev>',  // Use resend.dev sandbox — change to your domain later
        to: recipients,
        subject: subject,
        text: body,
        html: htmlBody,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', result);
      return res.status(response.status).json({ error: result.message || 'Failed to send email via Resend.' });
    }

    return res.status(200).json({ ok: true, message: 'Email sent successfully', id: result.id });
  } catch (error) {
    console.error('Notification error:', error);
    return res.status(500).json({ error: error.message || 'Unexpected error sending email.' });
  }
}
