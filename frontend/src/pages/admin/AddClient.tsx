import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, UserPlus, X } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { API_URL } from '../../config/api';
import { useToast } from '../../components/ui/Toast';

const PAYMENT_METHODS = [
  { value: '', label: 'اختر طريقة الدفع (اختياري)' },
  { value: 'cash', label: 'كاش' },
  { value: 'transfer', label: 'تحويل بنكي' },
  { value: 'Tabby', label: 'Tabby' },
  { value: 'Tamara', label: 'Tamara' },
];

export function AddClient() {
  const { token } = useAuthStore();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    serviceName: '',
    amount: '',
    paymentMethod: '',
  });
  const [loading, setLoading] = useState(false);

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const isValid =
    form.firstName.trim() &&
    form.lastName.trim() &&
    form.email.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) &&
    form.phone.trim() &&
    form.password.length >= 6;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/tickets/create-manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('تم إضافة العميل بنجاح ✅');
        navigate('/dashboard');
      } else {
        showToast(data.error || 'فشل إضافة العميل', 'error');
      }
    } catch {
      showToast('تعذر الاتصال بالخادم', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <UserPlus className="w-6 h-6 text-emerald-600" /> ➕ إضافة عميل جديد
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">أضف عميل يدوياً وأنشئ له تيكت في النظام</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5">
        {/* Required Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">الاسم الأول <span className="text-red-500">*</span></label>
            <input type="text" value={form.firstName} onChange={e => update('firstName', e.target.value)}
              placeholder="مثال: أحمد" required
              className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">اسم العائلة <span className="text-red-500">*</span></label>
            <input type="text" value={form.lastName} onChange={e => update('lastName', e.target.value)}
              placeholder="مثال: العمري" required
              className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">البريد الإلكتروني <span className="text-red-500">*</span></label>
          <input type="email" value={form.email} onChange={e => update('email', e.target.value)}
            placeholder="ahmed@example.com" required dir="ltr"
            className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-300 text-left" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">رقم الجوال <span className="text-red-500">*</span></label>
            <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)}
              placeholder="05XXXXXXXX" required dir="ltr"
              className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-300 text-left" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">كلمة المرور <span className="text-red-500">*</span></label>
            <input type="password" value={form.password} onChange={e => update('password', e.target.value)}
              placeholder="6 حروف على الأقل" required minLength={6} dir="ltr"
              className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-300 text-left" />
          </div>
        </div>

        {/* Optional Fields */}
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">بيانات اختيارية</p>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">الخدمة المطلوبة</label>
            <input type="text" value={form.serviceName} onChange={e => update('serviceName', e.target.value)}
              placeholder="مثال: تصميم متجر إلكتروني"
              className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">المبلغ</label>
              <input type="text" value={form.amount} onChange={e => update('amount', e.target.value)}
                placeholder="مثال: 5000" dir="ltr"
                className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 text-left" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">طريقة الدفع</label>
              <select value={form.paymentMethod} onChange={e => update('paymentMethod', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200">
                {PAYMENT_METHODS.map(pm => (
                  <option key={pm.value} value={pm.value}>{pm.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
          <button type="submit" disabled={!isValid || loading}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الإضافة...</> : <><UserPlus className="w-4 h-4" /> إضافة العميل</>}
          </button>
          <button type="button" onClick={() => navigate('/dashboard')}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer">
            <X className="w-4 h-4" /> إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}
