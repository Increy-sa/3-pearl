import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, CreditCard, ShieldCheck, ArrowLeft, FileText, Upload, LogIn, Loader2, IdCard, Info, Smartphone, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { API_URL } from '../../config/api';

interface LegalInfoData {
  customerName: string;
  email: string;
  phone: string;
  nationalId: string;
  iban: string;
  hasDocument: boolean;
  documentFileUrl?: string;
  hasLegalDoc: boolean;
  needsLegalExtraction: boolean;
  documentStatus: 'PROVIDED' | 'NEEDS_EXTRACTION';
  nationalIdUrl?: string;
  fullNameInId?: string;
  absherPhone?: string;
}

interface Props {
  onNext: (data: LegalInfoData) => void;
  initialData?: Partial<LegalInfoData>;
}

export function LegalInfoForm({ onNext, initialData }: Props) {
  const { user } = useAuthStore();

  // ── Real-time input restriction helpers ────────────────────────────────
  /** Allow only digit keys (0-9) — blocks letters, symbols, Arabic numerals */
  const numericKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const nav = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab','Home','End','Enter'];
    if (!nav.includes(e.key) && !/^[0-9]$/.test(e.key)) e.preventDefault();
  };

  /** Strip non-digits from pasted content */
  const numericPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const cleaned = e.clipboardData.getData('text').replace(/\D/g, '');
    const input = e.currentTarget;
    const max = Number(input.getAttribute('maxlength') || 999);
    const val = (input.value.slice(0, input.selectionStart ?? 0) + cleaned).slice(0, max);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  /** Allow only letters + digits for IBAN (any country code) */
  const ibanKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const nav = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab','Home','End','Enter'];
    if (!nav.includes(e.key) && !/^[a-zA-Z0-9]$/.test(e.key)) e.preventDefault();
  };

  /** Strip non-alphanumeric from pasted IBAN & auto-uppercase */
  const ibanPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const cleaned = e.clipboardData.getData('text').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const input = e.currentTarget;
    const val = cleaned.slice(0, 34);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  /** Auto-uppercase typed IBAN characters */
  const ibanInput = (e: React.FormEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const upper = input.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (upper !== input.value) {
      const pos = input.selectionStart;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, upper);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.setSelectionRange(pos, pos);
    }
  };
  // ────────────────────────────────────────────────────────────────────────

  // For Adtopia users who are already authenticated, pre-fill their known data
  // and prevent editing so they don't have to re-enter webhook-provided info.
  const isAuthenticated = !!user;
  const prefill = {
    customerName: user?.name || initialData?.customerName || '',
    email:        user?.email || initialData?.email || '',
    phone:        user?.phone || initialData?.phone || '',  // from Adtopia webhook
  };

  const [hasDocument, setHasDocument] = useState<string | null>(
    initialData?.hasLegalDoc === false ? 'no' : initialData?.hasDocument ? 'yes' : null
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [idFileName, setIdFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  // ── Validation patterns ────────────────────────────────────────────────
  const PATTERNS = {
    name:       /^[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFFa-zA-Z\s''\-.]{2,60}$/,
    email:      /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/,
    phone:      /^05[0-9]{8}$/,
    nationalId: /^[12][0-9]{9}$/,
    iban:       /^SA[0-9]{22}$/i,
  };

  type FieldKey = 'customerName'|'email'|'phone'|'nationalId'|'iban'|'fullNameInId'|'absherPhone';
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});

  const MESSAGES: Record<FieldKey, string> = {
    customerName:  'الاسم يجب أن يحتوي على أحرف فقط (2-60 حرف)',
    email:         'صيغة البريد الإلكتروني غير صحيحة',
    phone:         'رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام',
    nationalId:    'رقم الهوية يجب أن يكون 10 أرقام ويبدأ بـ 1 أو 2',
    iban:          'الآيبان يجب أن يبدأ بـ SA ويتكون من 24 حرفاً',
    fullNameInId:  'يرجى إدخال الاسم الكامل (حرفان على الأقل)',
    absherPhone:   'رقم جوال أبشر يجب أن يبدأ بـ 05 ويتكون من 10 أرقام',
  };

  const validate = (field: FieldKey, value: string): string => {
    if (!value.trim()) return 'هذا الحقل مطلوب';
    if (field === 'customerName' || field === 'fullNameInId') {
      return PATTERNS.name.test(value.trim()) ? '' : MESSAGES[field];
    }
    if (field === 'email')      return PATTERNS.email.test(value.trim())      ? '' : MESSAGES.email;
    if (field === 'phone' || field === 'absherPhone') {
      return PATTERNS.phone.test(value.replace(/\s/g,''))   ? '' : MESSAGES[field];
    }
    if (field === 'nationalId') return PATTERNS.nationalId.test(value.trim()) ? '' : MESSAGES.nationalId;
    if (field === 'iban')       return PATTERNS.iban.test(value.replace(/\s/g,'').toUpperCase()) ? '' : MESSAGES.iban;
    return '';
  };

  const onBlur = (field: FieldKey) => (e: React.FocusEvent<HTMLInputElement>) => {
    setTouched(t => ({ ...t, [field]: true }));
    setErrors(ev => ({ ...ev, [field]: validate(field, e.target.value) }));
  };

  const onChange = (field: FieldKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (touched[field]) {
      setErrors(ev => ({ ...ev, [field]: validate(field, e.target.value) }));
    }
  };

  // Helper: red border + message under the input
  const ErrMsg = ({ field }: { field: FieldKey }) =>
    touched[field] && errors[field]
      ? <p className="mt-1 text-xs text-red-500 flex items-center gap-1">⚠ {errors[field]}</p>
      : null;

  const errClass = (field: FieldKey) =>
    touched[field] && errors[field]
      ? 'border-red-400 focus:ring-red-400 focus:border-red-400'
      : 'border-slate-200 focus:ring-blue-500 focus:border-blue-500';
  // ─────────────────────────────────────────────────────────────────────────

  const uploadFile = async (file: File): Promise<string> => {
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    const fileData = await base64Promise;

    const response = await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, fileData })
    });

    if (!response.ok) throw new Error('Upload failed');
    const result = await response.json();
    return result.url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasDocument) return;

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    // ── Validate all fields before upload ──────────────────────────────────
    const fieldsToValidate: FieldKey[] = hasDocument === 'no'
      ? ['fullNameInId', 'absherPhone', 'customerName', 'email', 'phone', 'nationalId', 'iban']
      : ['customerName', 'email', 'phone', 'nationalId', 'iban'];

    // Skip fields pre-filled by authenticated user
    const skipIfAuth: FieldKey[] = isAuthenticated
      ? ['customerName', 'email', ...(prefill.phone ? ['phone' as FieldKey] : [])]
      : [];

    const newErrors: Partial<Record<FieldKey, string>> = {};
    const newTouched: Partial<Record<FieldKey, boolean>> = {};

    for (const field of fieldsToValidate) {
      if (skipIfAuth.includes(field)) continue;
      const val = (formData.get(field) as string) || '';
      newTouched[field] = true;
      const err = validate(field, val);
      if (err) newErrors[field] = err;
    }

    setTouched(t => ({ ...t, ...newTouched }));
    setErrors(ev => ({ ...ev, ...newErrors }));

    if (Object.keys(newErrors).length > 0) return; // ← block if any error
    // ──────────────────────────────────────────────────────────────────────

    setUploading(true);

    try {
      let documentFileUrl = initialData?.documentFileUrl || '';
      let nationalIdUrl = initialData?.nationalIdUrl || '';

      if (hasDocument === 'yes') {
        const fileInput = form.querySelector('input[name="legalDoc"]') as HTMLInputElement;
        const file = fileInput?.files?.[0];
        if (file) {
          documentFileUrl = await uploadFile(file);
        }
      } else {
        const idInput = form.querySelector('input[name="nationalIdFile"]') as HTMLInputElement;
        const idFile = idInput?.files?.[0];
        if (idFile) {
          nationalIdUrl = await uploadFile(idFile);
        }
      }

      const data: LegalInfoData = {
        customerName: formData.get('customerName') as string,
        email: formData.get('email') as string,
        phone: formData.get('phone') as string,
        nationalId: formData.get('nationalId') as string,
        iban: formData.get('iban') as string,
        hasDocument: hasDocument === 'yes',
        documentFileUrl,
        hasLegalDoc: hasDocument === 'yes',
        needsLegalExtraction: hasDocument === 'no',
        documentStatus: hasDocument === 'yes' ? 'PROVIDED' : 'NEEDS_EXTRACTION',
        nationalIdUrl: hasDocument === 'no' ? nationalIdUrl : undefined,
        fullNameInId: hasDocument === 'no' ? (formData.get('fullNameInId') as string) : undefined,
        absherPhone: hasDocument === 'no' ? (formData.get('absherPhone') as string) : undefined,
      };
      onNext(data);
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };


  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 md:p-8 bg-white rounded-2xl shadow-xl shadow-slate-200 border border-slate-100">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">البيانات القانونية</h2>
          <p className="text-slate-500 mt-1 sm:mt-2 text-sm sm:text-base">نحتاج لبعض البيانات الأساسية لتوثيق حسابك.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="flex items-center gap-2 text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 sm:px-4 py-2 rounded-xl font-medium transition-all text-sm sm:text-base w-full sm:w-auto justify-center"
        >
          <span>لديك حساب؟ تسجيل الدخول</span>
          <LogIn className="w-4 h-4" />
        </button>
      </div>

      <div className="mb-6 sm:mb-8 p-4 sm:p-6 bg-slate-50 rounded-2xl border border-slate-100">
        <label className="text-sm sm:text-base font-bold text-slate-800 mb-3 sm:mb-4 block flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600 shrink-0" />
          هل لديك وثيقة عمل حر أو سجل تجاري حالياً؟
        </label>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => setHasDocument('yes')}
            className={`py-3 sm:py-4 px-3 sm:px-6 rounded-xl border-2 transition-all duration-300 flex items-center justify-center gap-1.5 sm:gap-2 font-medium text-sm sm:text-base ${
              hasDocument === 'yes' ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-md shadow-blue-100' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            <CheckCircle2 className={`w-4 h-4 sm:w-5 sm:h-5 transition-all duration-300 shrink-0 ${hasDocument === 'yes' ? 'text-blue-600' : 'text-slate-300'}`} />
            <span>نعم، متوفرة</span>
          </button>
          <button
            type="button"
            onClick={() => setHasDocument('no')}
            className={`py-3 sm:py-4 px-3 sm:px-6 rounded-xl border-2 transition-all duration-300 flex items-center justify-center gap-1.5 sm:gap-2 font-medium text-sm sm:text-base ${
              hasDocument === 'no' ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-md shadow-amber-100' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            <IdCard className={`w-4 h-4 sm:w-5 sm:h-5 transition-all duration-300 shrink-0 ${hasDocument === 'no' ? 'text-amber-600' : 'text-slate-300'}`} />
            <span>لا، أحتاج استخراج</span>
          </button>
        </div>
      </div>

      {hasDocument === 'no' && (
        <div className="mb-6 sm:mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="p-4 sm:p-5 bg-gradient-to-l from-amber-50 to-orange-50 rounded-2xl border border-amber-200 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                <Info className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
              </div>
              <div>
                <h4 className="font-bold text-amber-900 text-xs sm:text-sm mb-1">طلب استخراج وثيقة عمل حر / سجل تجاري</h4>
                <p className="text-amber-700 text-[11px] sm:text-xs leading-relaxed">
                  سنقوم باستخدام هذه البيانات لاستخراج الوثيقة القانونية لمتجرك آلياً. يرجى التأكد من صحة البيانات المدخلة.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <IdCard className="w-4 h-4 text-amber-500 shrink-0" />
                صورة الهوية الوطنية / الإقامة <span className="text-slate-400">(اختياري)</span>
              </label>
              <div className="relative">
                <input
                  type="file"
                  name="nationalIdFile"
                  accept="image/*,.pdf"
                  onChange={(e) => setIdFileName(e.target.files?.[0]?.name || null)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className={`w-full px-4 py-5 sm:py-6 border-2 border-dashed rounded-xl text-center transition-all duration-300 ${
                  idFileName ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-slate-50 hover:border-amber-300'
                }`}>
                  {idFileName ? (
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-amber-600 shrink-0" />
                      <p className="text-xs sm:text-sm text-amber-700 font-medium truncate">{idFileName}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-6 h-6 text-slate-400" />
                      <p className="text-xs sm:text-sm text-slate-500">اضغط هنا لرفع صورة الهوية (اختياري)</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <User className="w-4 h-4 text-amber-500 shrink-0" />
                الاسم الكامل (كما هو في الهوية) <span className="text-red-500">*</span>
              </label>
              <input
                required
                name="fullNameInId"
                type="text"
                defaultValue={initialData?.fullNameInId}
                onBlur={onBlur('fullNameInId')}
                onChange={onChange('fullNameInId')}
                className={`w-full px-4 py-3 rounded-xl border outline-none transition-all text-start text-sm sm:text-base focus:ring-2 ${errClass('fullNameInId')}`}
                placeholder="الاسم الرباعي كما هو في الهوية"
              />
              <ErrMsg field="fullNameInId" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-amber-500 shrink-0" />
                رقم الجوال المرتبط بأبشر <span className="text-red-500">*</span>
              </label>
              <input
                required
                name="absherPhone"
                type="tel"
                inputMode="numeric"
                defaultValue={initialData?.absherPhone}
                maxLength={10}
                onKeyDown={numericKey}
                onPaste={numericPaste}
                onBlur={onBlur('absherPhone')}
                onChange={onChange('absherPhone')}
                className={`w-full px-4 py-3 rounded-xl border outline-none transition-all text-start text-sm sm:text-base focus:ring-2 ${errClass('absherPhone')}`}
                placeholder="0512345678"
                dir="ltr"
              />
              <ErrMsg field="absherPhone" />
            </div>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-4 text-xs text-slate-400 font-medium">البيانات الأساسية</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-500 shrink-0" />
                  اسم العميل
                  {isAuthenticated && <span className="text-[10px] text-slate-400 font-normal">(مسجّل)</span>}
                </label>
                <input
                  required
                  name="customerName"
                  type="text"
                  defaultValue={prefill.customerName}
                  readOnly={isAuthenticated}
                  onBlur={!isAuthenticated ? onBlur('customerName') : undefined}
                  onChange={!isAuthenticated ? onChange('customerName') : undefined}
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all text-start text-sm sm:text-base ${
                    isAuthenticated ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : `focus:ring-2 ${errClass('customerName')}`
                  }`}
                  placeholder="أحمد محمد"
                />
                {!isAuthenticated && <ErrMsg field="customerName" />}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-500 shrink-0" />
                  البريد الإلكتروني
                  {isAuthenticated && <span className="text-[10px] text-slate-400 font-normal">(مسجّل)</span>}
                </label>
                <input
                  required
                  name="email"
                  type="email"
                  defaultValue={prefill.email}
                  readOnly={isAuthenticated}
                  onBlur={!isAuthenticated ? onBlur('email') : undefined}
                  onChange={!isAuthenticated ? onChange('email') : undefined}
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all text-start text-sm sm:text-base ${
                    isAuthenticated ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : `focus:ring-2 ${errClass('email')}`
                  }`}
                  placeholder="ahmed@example.com"
                />
                {!isAuthenticated && <ErrMsg field="email" />}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-500 shrink-0" />
                رقم الجوال
                {prefill.phone && <span className="text-[10px] text-slate-400 font-normal">(مسجّل)</span>}
              </label>
              <input
                required
                name="phone"
                type="tel"
                inputMode="numeric"
                defaultValue={prefill.phone}
                readOnly={!!prefill.phone}
                maxLength={10}
                onKeyDown={!prefill.phone ? numericKey : undefined}
                onPaste={!prefill.phone ? numericPaste : undefined}
                onBlur={!prefill.phone ? onBlur('phone') : undefined}
                onChange={!prefill.phone ? onChange('phone') : undefined}
                className={`w-full px-4 py-3 rounded-xl border outline-none transition-all text-start text-sm sm:text-base ${
                  prefill.phone ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : `focus:ring-2 ${errClass('phone')}`
                }`}
                placeholder="0512345678"
                dir="ltr"
              />
              {!prefill.phone && <ErrMsg field="phone" />}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0" />
                رقم الهوية / الإقامة
              </label>
              <input
                required
                name="nationalId"
                type="text"
                inputMode="numeric"
                defaultValue={initialData?.nationalId}
                maxLength={10}
                onKeyDown={numericKey}
                onPaste={numericPaste}
                onBlur={onBlur('nationalId')}
                onChange={onChange('nationalId')}
                className={`w-full px-4 py-3 rounded-xl border outline-none transition-all text-start text-sm sm:text-base focus:ring-2 ${errClass('nationalId')}`}
                placeholder="1234567890"
                dir="ltr"
              />
              <ErrMsg field="nationalId" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-500 shrink-0" />
                رقم الآيبان (IBAN)
              </label>
              <input
                required
                name="iban"
                type="text"
                inputMode="text"
                defaultValue={initialData?.iban}
                maxLength={34}
                onKeyDown={ibanKey}
                onPaste={ibanPaste}
                onInput={ibanInput}
                onBlur={onBlur('iban')}
                onChange={onChange('iban')}
                className={`w-full px-4 py-3 rounded-xl border outline-none transition-all text-start text-sm sm:text-base font-mono tracking-wide focus:ring-2 ${errClass('iban')}`}
                placeholder="SA04 8000 0000 6080 1016 7519"
                dir="ltr"
              />
              <ErrMsg field="iban" />
            </div>

            <button type="submit" disabled={uploading} className="w-full py-3.5 sm:py-4 px-6 bg-gradient-to-l from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-medium shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 text-sm sm:text-base">
              {uploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  جاري رفع البيانات...
                </>
              ) : (
                <>
                  المتابعة لبناء الهوية التجارية
                  <ArrowLeft className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {hasDocument === 'yes' && (
        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-500 shrink-0" />
              رفع السجل أو الوثيقة (PDF أو صورة)
            </label>
            <div className="relative">
              <input type="file" name="legalDoc" accept=".pdf,image/*" onChange={(e) => setFileName(e.target.files?.[0]?.name || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              <div className={`w-full px-4 py-5 sm:py-6 border-2 border-dashed rounded-xl text-center transition-all duration-300 ${
                fileName ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-blue-300'
              }`}>
                {fileName ? (
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                    <p className="text-xs sm:text-sm text-blue-700 font-medium truncate">{fileName}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-6 h-6 text-slate-400" />
                    <p className="text-xs sm:text-sm text-slate-500">اضغط هنا لرفع الملف أو اسحب الملف هنا</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pt-4 border-t border-slate-100">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-500 shrink-0" />
                اسم العميل
                {isAuthenticated && <span className="text-[10px] text-slate-400 font-normal">(مسجّل)</span>}
              </label>
              <input
                required
                name="customerName"
                type="text"
                defaultValue={prefill.customerName}
                readOnly={isAuthenticated}
                onBlur={!isAuthenticated ? onBlur('customerName') : undefined}
                onChange={!isAuthenticated ? onChange('customerName') : undefined}
                className={`w-full px-4 py-3 rounded-xl border outline-none transition-all text-start text-sm sm:text-base ${
                  isAuthenticated ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : `focus:ring-2 ${errClass('customerName')}`
                }`}
                placeholder="أحمد محمد"
              />
              {!isAuthenticated && <ErrMsg field="customerName" />}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-500 shrink-0" />
                البريد الإلكتروني
                {isAuthenticated && <span className="text-[10px] text-slate-400 font-normal">(مسجّل)</span>}
              </label>
              <input
                required
                name="email"
                type="email"
                defaultValue={prefill.email}
                readOnly={isAuthenticated}
                onBlur={!isAuthenticated ? onBlur('email') : undefined}
                onChange={!isAuthenticated ? onChange('email') : undefined}
                className={`w-full px-4 py-3 rounded-xl border outline-none transition-all text-start text-sm sm:text-base ${
                  isAuthenticated ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : `focus:ring-2 ${errClass('email')}`
                }`}
                placeholder="ahmed@example.com"
              />
              {!isAuthenticated && <ErrMsg field="email" />}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Phone className="w-4 h-4 text-blue-500 shrink-0" />
              رقم الجوال
              {prefill.phone && <span className="text-[10px] text-slate-400 font-normal">(مسجّل)</span>}
            </label>
            <input
              required
              name="phone"
              type="tel"
              inputMode="numeric"
              defaultValue={prefill.phone}
              readOnly={!!prefill.phone}
              maxLength={10}
              onKeyDown={!prefill.phone ? numericKey : undefined}
              onPaste={!prefill.phone ? numericPaste : undefined}
              onBlur={!prefill.phone ? onBlur('phone') : undefined}
              onChange={!prefill.phone ? onChange('phone') : undefined}
              className={`w-full px-4 py-3 rounded-xl border outline-none transition-all text-start text-sm sm:text-base ${
                prefill.phone ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : `focus:ring-2 ${errClass('phone')}`
              }`}
              placeholder="0512345678"
              dir="ltr"
            />
            {!prefill.phone && <ErrMsg field="phone" />}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0" />
              رقم الهوية / الإقامة
            </label>
            <input
              required
              name="nationalId"
              type="text"
              inputMode="numeric"
              defaultValue={initialData?.nationalId}
              maxLength={10}
              onKeyDown={numericKey}
              onPaste={numericPaste}
              onBlur={onBlur('nationalId')}
              onChange={onChange('nationalId')}
              className={`w-full px-4 py-3 rounded-xl border outline-none transition-all text-start text-sm sm:text-base focus:ring-2 ${errClass('nationalId')}`}
              placeholder="1234567890"
              dir="ltr"
            />
            <ErrMsg field="nationalId" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-500 shrink-0" />
              رقم الآيبان (IBAN)
            </label>
            <input
              required
              name="iban"
              type="text"
              inputMode="text"
              defaultValue={initialData?.iban}
              maxLength={34}
              onKeyDown={ibanKey}
              onPaste={ibanPaste}
              onInput={ibanInput}
              onBlur={onBlur('iban')}
              onChange={onChange('iban')}
              className={`w-full px-4 py-3 rounded-xl border outline-none transition-all text-start text-sm sm:text-base font-mono tracking-wide focus:ring-2 ${errClass('iban')}`}
              placeholder="SA04 8000 0000 6080 1016 7519"
              dir="ltr"
            />
            <ErrMsg field="iban" />
          </div>

          <button type="submit" disabled={uploading} className="w-full py-3.5 sm:py-4 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 text-sm sm:text-base">
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                جاري رفع الوثيقة...
              </>
            ) : (
              <>
                المتابعة لتفاصيل المتجر
                <ArrowLeft className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
