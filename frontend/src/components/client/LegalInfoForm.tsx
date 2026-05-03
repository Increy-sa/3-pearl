import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, CreditCard, ShieldCheck, ArrowLeft, FileText, Upload, LogIn, Loader2, IdCard, Info, Smartphone, CheckCircle2 } from 'lucide-react';

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
  const [hasDocument, setHasDocument] = useState<string | null>(
    initialData?.hasLegalDoc === false ? 'no' : initialData?.hasDocument ? 'yes' : null
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [idFileName, setIdFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  const uploadFile = async (file: File): Promise<string> => {
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    const fileData = await base64Promise;

    const response = await fetch('http://localhost:5000/api/upload', {
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
        // Optional in extraction path: if uploaded we keep it, otherwise still submit customer data.
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
          <p className="text-slate-500 mt-1 sm:mt-2 text-sm sm:text-base">نحتاج لبعض البيانات الأساسية لتوثيق حسابك في سلة.</p>
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
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all text-start text-sm sm:text-base"
                placeholder="الاسم الرباعي كما هو في الهوية"
              />
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
                defaultValue={initialData?.absherPhone}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all text-start text-sm sm:text-base"
                placeholder="05xxxxxxxx"
                dir="ltr"
              />
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
                </label>
                <input required name="customerName" type="text" defaultValue={initialData?.customerName} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-start text-sm sm:text-base" placeholder="أحمد محمد" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-500 shrink-0" />
                  البريد الإلكتروني
                </label>
                <input required name="email" type="email" defaultValue={initialData?.email} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-start text-sm sm:text-base" placeholder="ahmed@example.com" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-500 shrink-0" />
                رقم الجوال
              </label>
              <input required name="phone" type="tel" defaultValue={initialData?.phone} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-start text-sm sm:text-base" placeholder="05xxxxxxx" dir="ltr" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0" />
                رقم الهوية / الإقامة
              </label>
              <input required name="nationalId" type="text" defaultValue={initialData?.nationalId} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-start text-sm sm:text-base" placeholder="10xxxxxxxx" dir="ltr" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-500 shrink-0" />
                رقم الآيبان (IBAN)
              </label>
              <input required name="iban" type="text" defaultValue={initialData?.iban} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-start text-sm sm:text-base" placeholder="SAxxxxxxxxxxxxxxxxxxxx" dir="ltr" />
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
              </label>
              <input required name="customerName" type="text" defaultValue={initialData?.customerName} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-start text-sm sm:text-base" placeholder="أحمد محمد" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-500 shrink-0" />
                البريد الإلكتروني
              </label>
              <input required name="email" type="email" defaultValue={initialData?.email} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-start text-sm sm:text-base" placeholder="ahmed@example.com" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Phone className="w-4 h-4 text-blue-500 shrink-0" />
              رقم الجوال
            </label>
            <input required name="phone" type="tel" defaultValue={initialData?.phone} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-start text-sm sm:text-base" placeholder="05xxxxxxx" dir="ltr" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0" />
              رقم الهوية / الإقامة
            </label>
            <input required name="nationalId" type="text" defaultValue={initialData?.nationalId} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-start text-sm sm:text-base" placeholder="10xxxxxxxx" dir="ltr" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-500 shrink-0" />
              رقم الآيبان (IBAN)
            </label>
            <input required name="iban" type="text" defaultValue={initialData?.iban} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-start text-sm sm:text-base" placeholder="SAxxxxxxxxxxxxxxxxxxxx" dir="ltr" />
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
