/**
 * ══════════════════════════════════════════════════════════════
 *  Centralized Input Validation — Regex Rules
 *  Used in all API endpoints to sanitize and validate user input.
 * ══════════════════════════════════════════════════════════════
 */

// ── Patterns ──────────────────────────────────────────────────────────────────

export const PATTERNS = {
  /** Standard email address */
  email: /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/,

  /** Saudi mobile: 05xxxxxxxx (10 digits) */
  phone: /^(05)[0-9]{8}$/,

  /** Saudi National ID (1xxxxxxxxx) or Iqama (2xxxxxxxxx) — 10 digits */
  nationalId: /^[12][0-9]{9}$/,

  /** Saudi IBAN: SA + 22 digits */
  iban: /^SA[0-9]{22}$/i,

  /** Arabic or English name (2–60 chars, letters + spaces only) */
  name: /^[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFFa-zA-Z\s''\-\.]{2,60}$/,

  /** Business / store name (letters, numbers, Arabic, spaces, 2–80 chars) */
  businessName: /^[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFFa-zA-Z0-9\s''\-&\.]{2,80}$/,

  /** Text area content (1–2000 chars, no HTML tags) */
  text: /^[^<>]{1,2000}$/,

  /** Short text / category (1–100 chars, no HTML) */
  shortText: /^[^<>]{1,100}$/,

  /** URL (http/https) */
  url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)$/,

  /** JWT token — base64url segments separated by dots */
  jwt: /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/,
};

// ── Validation Result Type ─────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ── Field Validators ───────────────────────────────────────────────────────────

export function validateEmail(email: unknown): string | null {
  if (typeof email !== 'string' || !email.trim()) return 'البريد الإلكتروني مطلوب';
  if (!PATTERNS.email.test(email.trim())) return 'صيغة البريد الإلكتروني غير صحيحة';
  return null;
}

export function validatePhone(phone: unknown, required = true): string | null {
  if (!phone && !required) return null;
  if (typeof phone !== 'string' || !phone.trim()) return required ? 'رقم الجوال مطلوب' : null;
  const cleaned = phone.replace(/\s/g, '');
  if (!PATTERNS.phone.test(cleaned)) return 'رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام';
  return null;
}

export function validateNationalId(id: unknown, required = true): string | null {
  if (!id && !required) return null;
  if (typeof id !== 'string' || !id.trim()) return required ? 'رقم الهوية / الإقامة مطلوب' : null;
  if (!PATTERNS.nationalId.test(id.trim())) return 'رقم الهوية يجب أن يكون 10 أرقام ويبدأ بـ 1 أو 2';
  return null;
}

export function validateIban(iban: unknown, required = true): string | null {
  if (!iban && !required) return null;
  if (typeof iban !== 'string' || !iban.trim()) return required ? 'رقم الآيبان مطلوب' : null;
  const cleaned = iban.replace(/\s/g, '').toUpperCase();
  if (!PATTERNS.iban.test(cleaned)) return 'الآيبان السعودي يجب أن يبدأ بـ SA ويتكون من 24 حرفاً';
  return null;
}

export function validateName(name: unknown, label = 'الاسم', required = true): string | null {
  if (!name && !required) return null;
  if (typeof name !== 'string' || !name.trim()) return required ? `${label} مطلوب` : null;
  if (!PATTERNS.name.test(name.trim())) return `${label} يجب أن يحتوي على أحرف فقط (2-60 حرف)`;
  return null;
}

export function validateBusinessName(name: unknown, required = true): string | null {
  if (!name && !required) return null;
  if (typeof name !== 'string' || !name.trim()) return required ? 'اسم النشاط التجاري مطلوب' : null;
  if (!PATTERNS.businessName.test(name.trim())) return 'اسم النشاط يجب أن يكون بين 2 و 80 حرف ولا يحتوي على رموز HTML';
  return null;
}

export function validateText(text: unknown, label = 'النص', required = true, maxLen = 2000): string | null {
  if (!text && !required) return null;
  if (typeof text !== 'string' || !text.trim()) return required ? `${label} مطلوب` : null;
  if (text.length > maxLen) return `${label} يجب ألا يتجاوز ${maxLen} حرف`;
  if (/<[^>]*>/.test(text)) return `${label} يحتوي على رموز غير مسموح بها`;
  return null;
}

// ── Composite Validators ───────────────────────────────────────────────────────

/** Validate the login endpoint body */
export function validateLoginBody(body: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const emailErr = validateEmail(body.email);
  if (emailErr) errors.push(emailErr);
  return { valid: errors.length === 0, errors };
}

/** Validate the create-with-ai / onboarding body */
export function validateOnboardingBody(body: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];

  // Only validate the core fields required for AI generation
  const businessNameErr = validateBusinessName(body.businessName);
  if (businessNameErr) errors.push(businessNameErr);

  const industryErr = validateText(body.industry, 'مجال العمل', true, 100);
  if (industryErr) errors.push(industryErr);

  if (body.description) {
    const descErr = validateText(body.description, 'وصف النشاط', false, 1000);
    if (descErr) errors.push(descErr);
  }

  if (body.email) {
    const emailErr = validateEmail(body.email);
    if (emailErr) errors.push(emailErr);
  }

  // Note: phone, nationalId, iban, customerName are validated strictly in create-final.
  // They are passed here from legalData for persistence only — do not re-validate them
  // at this stage to avoid false 400 errors caused by partial or pre-filled data.

  return { valid: errors.length === 0, errors };
}


/** Validate the legal info form body */
export function validateLegalBody(body: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];

  const nameErr = validateName(body.customerName, 'اسم العميل');
  if (nameErr) errors.push(nameErr);

  const emailErr = validateEmail(body.email);
  if (emailErr) errors.push(emailErr);

  const phoneErr = validatePhone(body.phone);
  if (phoneErr) errors.push(phoneErr);

  const idErr = validateNationalId(body.nationalId);
  if (idErr) errors.push(idErr);

  const ibanErr = validateIban(body.iban);
  if (ibanErr) errors.push(ibanErr);

  return { valid: errors.length === 0, errors };
}
