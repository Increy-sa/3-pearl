/**
 * ══════════════════════════════════════════════════════════════
 *  Frontend Input Validation — Regex Rules
 *  Used in form onSubmit handlers and inline validation.
 * ══════════════════════════════════════════════════════════════
 */

// ── Patterns (HTML pattern attribute & JS validation) ─────────────────────────

export const PATTERNS = {
  email:        /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/,
  phone:        /^(05)[0-9]{8}$/,
  nationalId:   /^[12][0-9]{9}$/,
  iban:         /^SA[0-9]{22}$/i,
  name:         /^[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFFa-zA-Z\s''\-\.]{2,60}$/,
  businessName: /^[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFFa-zA-Z0-9\s''\-&\.]{2,80}$/,
  text:         /^[^<>]{1,2000}$/,
};

/** Pattern strings for HTML `pattern` attribute (no surrounding slashes or flags) */
export const HTML_PATTERNS = {
  email:      "[^\\s@]{1,64}@[^\\s@]{1,255}\\.[^\\s@]{2,}",
  phone:      "05[0-9]{8}",
  nationalId: "[12][0-9]{9}",
  iban:       "[Ss][Aa][0-9]{22}",
  name:       "[\\u0600-\\u06FF\\u0750-\\u077F\\uFB50-\\uFDFF\\uFE70-\\uFEFFa-zA-Z\\s''\\-.]{2,60}",
};

// ── Field Validators ───────────────────────────────────────────────────────────

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'البريد الإلكتروني مطلوب';
  if (!PATTERNS.email.test(email.trim())) return 'صيغة البريد الإلكتروني غير صحيحة';
  return null;
}

export function validatePhone(phone: string, required = true): string | null {
  if (!phone.trim()) return required ? 'رقم الجوال مطلوب' : null;
  const cleaned = phone.replace(/\s/g, '');
  if (!PATTERNS.phone.test(cleaned)) return 'رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام';
  return null;
}

export function validateNationalId(id: string, required = true): string | null {
  if (!id.trim()) return required ? 'رقم الهوية / الإقامة مطلوب' : null;
  if (!PATTERNS.nationalId.test(id.trim())) return 'رقم الهوية يجب أن يكون 10 أرقام ويبدأ بـ 1 أو 2';
  return null;
}

export function validateIban(iban: string, required = true): string | null {
  if (!iban.trim()) return required ? 'رقم الآيبان مطلوب' : null;
  const cleaned = iban.replace(/\s/g, '').toUpperCase();
  if (!PATTERNS.iban.test(cleaned)) return 'الآيبان يجب أن يبدأ بـ SA ويتكون من 24 حرفاً';
  return null;
}

export function validateName(name: string, label = 'الاسم', required = true): string | null {
  if (!name.trim()) return required ? `${label} مطلوب` : null;
  if (!PATTERNS.name.test(name.trim())) return `${label} يجب أن يحتوي على أحرف فقط (2–60 حرف)`;
  return null;
}

export function validateBusinessName(name: string, required = true): string | null {
  if (!name.trim()) return required ? 'اسم النشاط التجاري مطلوب' : null;
  if (!PATTERNS.businessName.test(name.trim())) return 'اسم النشاط يجب أن يكون بين 2 و 80 حرف';
  return null;
}

export function validateText(text: string, label = 'النص', required = true, maxLen = 2000): string | null {
  if (!text.trim()) return required ? `${label} مطلوب` : null;
  if (text.length > maxLen) return `${label} يجب ألا يتجاوز ${maxLen} حرف`;
  if (/<[^>]*>/.test(text)) return `${label} يحتوي على رموز غير مسموح بها`;
  return null;
}

// ── Composite Form Validators ──────────────────────────────────────────────────

export interface FormErrors {
  [field: string]: string;
}

/** Validate login form */
export function validateLoginForm(email: string): FormErrors {
  const errors: FormErrors = {};
  const emailErr = validateEmail(email);
  if (emailErr) errors.email = emailErr;
  return errors;
}

/** Validate legal info form */
export function validateLegalForm(data: {
  customerName: string;
  email: string;
  phone: string;
  nationalId?: string;
  iban?: string;
}): FormErrors {
  const errors: FormErrors = {};

  const nameErr = validateName(data.customerName, 'اسم العميل');
  if (nameErr) errors.customerName = nameErr;

  const emailErr = validateEmail(data.email);
  if (emailErr) errors.email = emailErr;

  const phoneErr = validatePhone(data.phone);
  if (phoneErr) errors.phone = phoneErr;

  if (data.nationalId) {
    const idErr = validateNationalId(data.nationalId, false);
    if (idErr) errors.nationalId = idErr;
  }

  if (data.iban) {
    const ibanErr = validateIban(data.iban, false);
    if (ibanErr) errors.iban = ibanErr;
  }

  return errors;
}

/** Validate client intake (store details) form */
export function validateIntakeForm(data: {
  businessName: string;
  industry: string;
  description?: string;
  targetAudience?: string;
}): FormErrors {
  const errors: FormErrors = {};

  const nameErr = validateBusinessName(data.businessName);
  if (nameErr) errors.businessName = nameErr;

  if (!data.industry || !data.industry.trim()) errors.industry = 'مجال العمل مطلوب';

  if (data.description) {
    const descErr = validateText(data.description, 'وصف النشاط', false, 1000);
    if (descErr) errors.description = descErr;
  }

  return errors;
}
