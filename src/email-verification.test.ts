import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildVerificationEmailHtml,
  buildVerificationEmailText,
  sendTransactionalEmail,
} from './services/emailService';
import { sendVerificationCode, verifyOtpCode } from './services/authService';

describe('Authoritative Registration Email Verification System', () => {
  const sampleOtp = '849201';
  const testEmail = 'newuser@example.com';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('generates email body containing the OTP and Tallix registration purpose', () => {
    const html = buildVerificationEmailHtml(sampleOtp);
    const text = buildVerificationEmailText(sampleOtp);

    // Must clearly contain the OTP
    expect(html).toContain(sampleOtp);
    expect(text).toContain(sampleOtp);

    // Must clearly state it is for Tallix account registration
    expect(html).toContain('TALLIX');
    expect(html).toContain('Verify Your Email Address');
    expect(html).toContain('account registration');
    expect(text).toContain('Tallix Email Verification');
    expect(text).toContain('account registration');

    // Must state 10 minutes expiration and single-use
    expect(html).toContain('10 minutes');
    expect(html).toContain('single-use');
    expect(text).toContain('10 minutes');
    expect(text).toContain('only be used once');
  });

  it('ensures sendVerificationCode API response NEVER exposes the OTP', async () => {
    // Mock server response
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: 'Verification code sent to your email.',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await sendVerificationCode(testEmail);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Verification code sent to your email.');
    // CRITICAL: The response must NEVER contain an 'otp' field
    expect((result as any).otp).toBeUndefined();
    expect((result as any).code).toBeUndefined();
  });

  it('rejects verification when invalid code is submitted', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: 'Invalid verification code. Please check the code and try again.',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await verifyOtpCode(testEmail, '000000');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid verification code');
  });

  it('succeeds verification when correct server-side code is verified', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: 'Email verified successfully.',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await verifyOtpCode(testEmail, '849201');

    expect(result.success).toBe(true);
    expect(result.message).toContain('Email verified successfully');
  });

  it('dispatches to Resend API when RESEND_API_KEY is configured', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'email_res_123' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await sendTransactionalEmail(
      {
        to: testEmail,
        subject: 'Tallix Email Verification',
        text: buildVerificationEmailText(sampleOtp),
        html: buildVerificationEmailHtml(sampleOtp),
      },
      {
        resendApiKey: 're_test_key_12345',
        resendFromEmail: 'Tallix <onboarding@resend.dev>',
      }
    );

    expect(result.success).toBe(true);
    expect(result.provider).toBe('resend');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer re_test_key_12345',
        }),
      })
    );
  });

  it('gracefully reports unconfigured state when no email keys are present', async () => {
    const result = await sendTransactionalEmail(
      {
        to: testEmail,
        subject: 'Tallix Email Verification',
        text: buildVerificationEmailText(sampleOtp),
        html: buildVerificationEmailHtml(sampleOtp),
      },
      {}
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('No transactional email provider is configured');
  });
});
