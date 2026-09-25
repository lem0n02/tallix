// Authoritative Transactional Email Service for Tallix
// Supports Resend, Brevo, SendGrid, Postmark, Mailgun, and SMTP

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailProviderConfig {
  resendApiKey?: string;
  resendFromEmail?: string;
  brevoApiKey?: string;
  brevoSenderEmail?: string;
  sendgridApiKey?: string;
  sendgridFromEmail?: string;
  postmarkServerToken?: string;
  postmarkFromEmail?: string;
  mailgunApiKey?: string;
  mailgunDomain?: string;
  mailgunFromEmail?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
}

/**
 * Builds standard, clean HTML template for email verification.
 */
export function buildVerificationEmailHtml(otp: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tallix Email Verification</title>
</head>
<body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #fafafa;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #09090b; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 36px 28px; text-align: left;">
          <tr>
            <td>
              <div style="margin-bottom: 24px;">
                <span style="font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">TALLIX</span>
                <span style="font-size: 11px; font-weight: 700; color: #10b981; background-color: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); padding: 2px 8px; border-radius: 12px; margin-left: 8px; vertical-align: middle;">VERIFICATION</span>
              </div>
              
              <h1 style="font-size: 18px; font-weight: 700; color: #ffffff; margin: 0 0 12px 0;">Verify Your Email Address</h1>
              <p style="font-size: 14px; line-height: 22px; color: #a1a1aa; margin: 0 0 24px 0;">
                Thank you for signing up with Tallix! Please use the following 6-digit One-Time Passcode (OTP) to complete your account registration:
              </p>

              <div style="background-color: #09090b; border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                <span style="font-family: 'SF Mono', Consolas, Menlo, Monaco, monospace; font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #10b981; display: inline-block; margin-left: 10px;">${otp}</span>
              </div>

              <p style="font-size: 12px; line-height: 20px; color: #71717a; margin: 0 0 8px 0;">
                • This code is valid for <strong>10 minutes</strong>.<br/>
                • This code is single-use and strictly for completing your Tallix account registration.<br/>
                • Never share this verification code with anyone.
              </p>

              <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #27272a; font-size: 11px; color: #52525b; line-height: 18px;">
                If you did not request this verification, you can safely ignore this email. No account will be created without this code.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Builds standard plain-text version of email verification.
 */
export function buildVerificationEmailText(otp: string): string {
  return `Tallix Email Verification

Your 6-digit verification code is: ${otp}

Please enter this code on the registration page to complete your Tallix account registration.
This code is valid for 10 minutes and can only be used once.

If you did not request this verification, you can safely ignore this email.`;
}

/**
 * Dispatches an email using the best available configured provider.
 */
export async function sendTransactionalEmail(
  options: SendEmailOptions,
  config: EmailProviderConfig = {}
): Promise<{ success: boolean; provider?: string; error?: string }> {
  const resendApiKey = config.resendApiKey || (typeof process !== 'undefined' ? process.env?.RESEND_API_KEY : '');
  const brevoApiKey = config.brevoApiKey || (typeof process !== 'undefined' ? (process.env?.BREVO_API_KEY || process.env?.SIB_API_KEY) : '');
  const sendgridApiKey = config.sendgridApiKey || (typeof process !== 'undefined' ? process.env?.SENDGRID_API_KEY : '');
  const postmarkToken = config.postmarkServerToken || (typeof process !== 'undefined' ? (process.env?.POSTMARK_SERVER_TOKEN || process.env?.POSTMARK_API_KEY) : '');
  const mailgunApiKey = config.mailgunApiKey || (typeof process !== 'undefined' ? process.env?.MAILGUN_API_KEY : '');
  const mailgunDomain = config.mailgunDomain || (typeof process !== 'undefined' ? process.env?.MAILGUN_DOMAIN : '');
  const smtpHost = config.smtpHost || (typeof process !== 'undefined' ? process.env?.SMTP_HOST : '');

  // 1. Provider: Resend (Recommended standard)
  if (resendApiKey) {
    try {
      const fromEmail = config.resendFromEmail || (typeof process !== 'undefined' ? process.env?.RESEND_FROM_EMAIL : '') || 'Tallix <onboarding@resend.dev>';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [options.to],
          subject: options.subject,
          html: options.html,
          text: options.text,
        }),
      });

      const resData: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData?.message || `Resend error HTTP ${res.status}`);
      }
      return { success: true, provider: 'resend' };
    } catch (err: any) {
      console.error('[EmailService] Resend dispatch failed:', err.message);
      return { success: false, provider: 'resend', error: err.message };
    }
  }

  // 2. Provider: Brevo (Sendinblue)
  if (brevoApiKey) {
    try {
      const senderEmail = config.brevoSenderEmail || (typeof process !== 'undefined' ? process.env?.BREVO_SENDER_EMAIL : '') || 'noreply@tallix.app';
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'Tallix', email: senderEmail },
          to: [{ email: options.to }],
          subject: options.subject,
          htmlContent: options.html,
          textContent: options.text,
        }),
      });

      const resData: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData?.message || `Brevo error HTTP ${res.status}`);
      }
      return { success: true, provider: 'brevo' };
    } catch (err: any) {
      console.error('[EmailService] Brevo dispatch failed:', err.message);
      return { success: false, provider: 'brevo', error: err.message };
    }
  }

  // 3. Provider: SendGrid
  if (sendgridApiKey) {
    try {
      const fromEmail = config.sendgridFromEmail || (typeof process !== 'undefined' ? process.env?.SENDGRID_FROM_EMAIL : '') || 'noreply@tallix.app';
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: options.to }] }],
          from: { email: fromEmail, name: 'Tallix' },
          subject: options.subject,
          content: [
            { type: 'text/plain', value: options.text },
            { type: 'text/html', value: options.html },
          ],
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`SendGrid error HTTP ${res.status}: ${text}`);
      }
      return { success: true, provider: 'sendgrid' };
    } catch (err: any) {
      console.error('[EmailService] SendGrid dispatch failed:', err.message);
      return { success: false, provider: 'sendgrid', error: err.message };
    }
  }

  // 4. Provider: Postmark
  if (postmarkToken) {
    try {
      const fromEmail = config.postmarkFromEmail || (typeof process !== 'undefined' ? process.env?.POSTMARK_FROM_EMAIL : '') || 'noreply@tallix.app';
      const res = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          'X-Postmark-Server-Token': postmarkToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          From: fromEmail,
          To: options.to,
          Subject: options.subject,
          HtmlBody: options.html,
          TextBody: options.text,
        }),
      });

      const resData: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData?.Message || `Postmark error HTTP ${res.status}`);
      }
      return { success: true, provider: 'postmark' };
    } catch (err: any) {
      console.error('[EmailService] Postmark dispatch failed:', err.message);
      return { success: false, provider: 'postmark', error: err.message };
    }
  }

  // 5. Provider: Mailgun
  if (mailgunApiKey && mailgunDomain) {
    try {
      const fromEmail = config.mailgunFromEmail || (typeof process !== 'undefined' ? process.env?.MAILGUN_FROM_EMAIL : '') || `Tallix <postmaster@${mailgunDomain}>`;
      const formData = new URLSearchParams();
      formData.append('from', fromEmail);
      formData.append('to', options.to);
      formData.append('subject', options.subject);
      formData.append('text', options.text);
      formData.append('html', options.html);

      const authHeader = typeof btoa !== 'undefined'
        ? `Basic ${btoa(`api:${mailgunApiKey}`)}`
        : `Basic ${Buffer.from(`api:${mailgunApiKey}`).toString('base64')}`;

      const res = await fetch(`https://api.mailgun.net/v3/${mailgunDomain}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const resData: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData?.message || `Mailgun error HTTP ${res.status}`);
      }
      return { success: true, provider: 'mailgun' };
    } catch (err: any) {
      console.error('[EmailService] Mailgun dispatch failed:', err.message);
      return { success: false, provider: 'mailgun', error: err.message };
    }
  }

  // 6. Provider: Node.js SMTP
  if (smtpHost && typeof process !== 'undefined') {
    try {
      // Dynamic import to prevent bundler errors in Worker environment
      const nodemailer = await import('nodemailer');
      const port = config.smtpPort || (process.env?.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587);
      const user = config.smtpUser || process.env?.SMTP_USER;
      const pass = config.smtpPass || process.env?.SMTP_PASS;
      const from = config.smtpFrom || process.env?.SMTP_FROM || user || 'Tallix <noreply@tallix.app>';

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure: port === 465,
        auth: user && pass ? { user, pass } : undefined,
      });

      await transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      return { success: true, provider: 'smtp' };
    } catch (err: any) {
      console.error('[EmailService] SMTP dispatch failed:', err.message);
      return { success: false, provider: 'smtp', error: err.message };
    }
  }

  return {
    success: false,
    error: 'No transactional email provider is configured. Please configure RESEND_API_KEY in environment variables.',
  };
}
