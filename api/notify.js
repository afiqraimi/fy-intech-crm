const nodemailer = require('nodemailer');

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

  const { to_emails, smtp_email, smtp_password, subject, body } = req.body;

  if (!to_emails || !smtp_email || !smtp_password) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: smtp_email,
        pass: smtp_password,
      },
    });

    const htmlBody = `
    <html><body style="font-family:Arial,sans-serif;background:#0a0a0a;color:#fff;padding:30px;">
      <div style="max-width:600px;margin:0 auto;background:#121212;border:1px solid #262626;border-radius:16px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:30px;text-align:center;">
          <h1 style="color:#fff;font-size:22px;margin:0;">FY Intech CRM</h1>
          <p style="color:#a3a3a3;font-size:12px;margin:8px 0 0;">Intelligence Platform Notification</p>
        </div>
        <div style="padding:30px;">
          <p style="color:#e5e5e5;line-height:1.6;font-size:14px;">${body}</p>
        </div>
        <div style="padding:15px 30px;border-top:1px solid #262626;text-align:center;">
          <p style="color:#525252;font-size:11px;margin:0;">FY Intech CRM &bull; Automated Notification</p>
        </div>
      </div>
    </body></html>
    `;

    await transporter.sendMail({
      from: `"FY Intech CRM" <${smtp_email}>`,
      to: Array.isArray(to_emails) ? to_emails.join(', ') : to_emails,
      subject: subject,
      text: body,
      html: htmlBody,
    });

    return res.status(200).json({ ok: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('SMTP Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to send email' });
  }
}
