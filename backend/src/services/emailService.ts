/**
 * ══════════════════════════════════════════════════════════════
 *  Email Service — Resend API
 *  Handles: Welcome emails, OTP verification emails
 * ══════════════════════════════════════════════════════════════
 */

import { Resend } from 'resend';

const RESEND_KEY = process.env.RESEND_API_KEY || '';
const resend = new Resend(RESEND_KEY);
const EMAIL_FROM = process.env.EMAIL_FROM || 'Dot Media Operation <onboarding@resend.dev>';

// ── Startup diagnostic ──────────────────────────────────────────────────────
console.log(`[email] Config → FROM: "${EMAIL_FROM}", KEY: ${RESEND_KEY ? RESEND_KEY.slice(0, 8) + '...' : '❌ MISSING'}`);

// ── Helper: Get the system URL for links in emails ─────────────────────────
// Uses SYSTEM_URL (production domain) first, falls back to FRONTEND_URL
function getSystemUrl(): string {
  return process.env.SYSTEM_URL || process.env.FRONTEND_URL || 'https://capsystem.net';
}

// ════════════════════════════════════════════════════════════════
//  Welcome Email — sent when client is created from admin dashboard
// ════════════════════════════════════════════════════════════════
export async function sendWelcomeEmail(
  email: string,
  password: string,
  name: string
): Promise<boolean> {
  const systemUrl = getSystemUrl();

  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: 'مرحباً بك في Dot Media Operation — بيانات الدخول',
      html: `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Tahoma,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:32px 40px;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;">🌟 Dot Media Operation</h1>
    <p style="margin:8px 0 0;color:#94a3b8;font-size:14px;">نظام إدارة المشاريع</p>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:36px 40px;">
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px;">مرحباً ${name} 👋</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.7;">
      تم إنشاء حسابك بنجاح. استخدم البيانات التالية لتسجيل الدخول.
    </p>
    <p style="margin:0 0 16px;color:#475569;font-size:13px;font-weight:700;">بيانات تسجيل الدخول:</p>
    <!-- Email Field -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
      <tr>
        <td style="padding-bottom:5px;color:#94a3b8;font-size:12px;">📧 البريد الإلكتروني <span style="color:#cbd5e1;font-size:10px;">(اضغط مطولاً للنسخ)</span></td>
      </tr>
      <tr>
        <td style="background:#f0f9ff;border:2px solid #93c5fd;border-radius:10px;padding:14px 18px;">
          <code style="color:#1e40af;font-size:16px;font-weight:800;font-family:'Courier New',Courier,monospace;letter-spacing:0.5px;word-break:break-all;" dir="ltr">${email}</code>
        </td>
      </tr>
    </table>
    <!-- Password Field -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
      <tr>
        <td style="padding-bottom:5px;color:#94a3b8;font-size:12px;">🔑 كلمة المرور <span style="color:#cbd5e1;font-size:10px;">(اضغط مطولاً للنسخ)</span></td>
      </tr>
      <tr>
        <td style="background:#f0fdf4;border:2px solid #86efac;border-radius:10px;padding:14px 18px;">
          <code style="color:#166534;font-size:18px;font-weight:900;font-family:'Courier New',Courier,monospace;letter-spacing:2px;" dir="ltr">${password}</code>
        </td>
      </tr>
    </table>
    <!-- Login Link Field -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td style="padding-bottom:5px;color:#94a3b8;font-size:12px;">🔗 رابط تسجيل الدخول <span style="color:#cbd5e1;font-size:10px;">(اضغط مطولاً للنسخ)</span></td>
      </tr>
      <tr>
        <td style="background:#faf5ff;border:2px solid #d8b4fe;border-radius:10px;padding:14px 18px;">
          <a href="${systemUrl}" style="color:#7c3aed;font-size:14px;font-weight:700;font-family:'Courier New',Courier,monospace;text-decoration:none;word-break:break-all;" dir="ltr">${systemUrl}</a>
        </td>
      </tr>
    </table>
    <!-- CTA Button -->
    <a href="${systemUrl}" target="_blank" style="display:block;text-align:center;background:linear-gradient(135deg,#0f172a 0%,#334155 100%);color:#ffffff;padding:16px 32px;border-radius:12px;font-size:16px;font-weight:800;text-decoration:none;letter-spacing:0.5px;">
      🔑 تسجيل الدخول الآن
    </a>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="margin:0;color:#94a3b8;font-size:11px;">© ${new Date().getFullYear()} Dot Media Operation — جميع الحقوق محفوظة</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
    });
    if (result.error) {
      console.error(`[email] ❌ Resend API error for ${email}:`, JSON.stringify(result.error));
      return false;
    }
    console.log(`[email] ✅ Welcome email sent to ${email} — id: ${result.data?.id}`);
    return true;
  } catch (error: any) {
    console.error(`[email] ❌ Failed to send welcome email to ${email}:`, error?.message, error?.statusCode, JSON.stringify(error));
    return false;
  }
}

// ════════════════════════════════════════════════════════════════
//  OTP Email — sent for login verification
// ════════════════════════════════════════════════════════════════
export async function sendOtpEmail(
  email: string,
  name: string,
  otp: string
): Promise<boolean> {
  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: `${otp} — رمز التحقق من Dot Media Operation`,
      html: `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Tahoma,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:32px 40px;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;">🔐 رمز التحقق</h1>
    <p style="margin:8px 0 0;color:#94a3b8;font-size:14px;">Dot Media Operation</p>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:36px 40px;text-align:center;">
    <p style="margin:0 0 8px;color:#64748b;font-size:15px;">مرحباً ${name}،</p>
    <p style="margin:0 0 28px;color:#64748b;font-size:14px;line-height:1.7;">
      استخدم الرمز التالي لإتمام تسجيل الدخول. الرمز صالح لمدة <strong>5 دقائق</strong>.
    </p>
    <!-- OTP Code -->
    <div style="display:inline-block;background:#f0fdf4;border:2px solid #86efac;border-radius:16px;padding:20px 48px;margin-bottom:24px;">
      <span style="font-size:36px;font-weight:900;letter-spacing:12px;color:#0f172a;font-family:monospace;" dir="ltr">${otp}</span>
    </div>
    <p style="margin:20px 0 0;color:#cbd5e1;font-size:12px;">
      إذا لم تطلب هذا الرمز، يمكنك تجاهل هذا البريد.
    </p>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="margin:0;color:#94a3b8;font-size:11px;">© ${new Date().getFullYear()} Dot Media Operation — جميع الحقوق محفوظة</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
    });
    if (result.error) {
      console.error(`[email] ❌ Resend API error (OTP) for ${email}:`, JSON.stringify(result.error));
      return false;
    }
    console.log(`[email] ✅ OTP email sent to ${email} — id: ${result.data?.id}`);
    return true;
  } catch (error: any) {
    console.error(`[email] ❌ Failed to send OTP email to ${email}:`, error?.message, error?.statusCode, JSON.stringify(error));
    return false;
  }
}

// ── Generate a random 6-digit OTP code ──────────────────────────
export function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
