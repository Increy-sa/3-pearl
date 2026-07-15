import React, { useEffect, useState } from 'react';
import { Loader2, Save, Settings, Lock, KeyRound, CheckCircle2, MessageSquare, Paintbrush, Plus, Trash2, ChevronUp, ChevronDown, ToggleLeft, ToggleRight, Upload, Image as ImageIcon } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useToast } from '../../components/ui/Toast';

import { API_URL } from '../../config/api';

const API = API_URL;

const STAGE_LABELS: Record<string, string> = {
  INTAKE: 'استلام الطلب',
  SEO_STORE_SETUP: 'إعدادات الـ SEO',
  DESIGN: 'التصميم',
  DEVELOPMENT: 'التطوير والبرمجة',
  SEO_FINAL: 'المراجعة النهائية وSEO',
  DELIVERED: 'تم التسليم',
};

type SettingsPayload = {
  agencyProfile: {
    agencyName: string;
    contactEmail: string;
    whatsappNumber: string;
  };
  slaConfig: Record<string, number>;
};

export function AdminSettings() {
  const { token, user } = useAuthStore();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editingStage, setEditingStage] = useState<string | null>(null);
  const [agencyProfile, setAgencyProfile] = useState({ agencyName: '', contactEmail: '', whatsappNumber: '' });
  const [slaConfig, setSlaConfig] = useState<Record<string, number>>({});

  // Password change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Logo types state
  type LogoTypeItem = { id: string; name: string; description?: string; imageUrl?: string; sortOrder: number; isActive: boolean };
  const [logoTypes, setLogoTypes] = useState<LogoTypeItem[]>([]);
  const [logoLoading, setLogoLoading] = useState(true);
  const [newLogoName, setNewLogoName] = useState('');
  const [newLogoDesc, setNewLogoDesc] = useState('');
  const [editingLogo, setEditingLogo] = useState<LogoTypeItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [logoSaving, setLogoSaving] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  // Product suppliers state
  type SupplierItem = { id: string; name: string; description?: string; imageUrl?: string; sortOrder: number; isActive: boolean };
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [supplierLoading, setSupplierLoading] = useState(true);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierDesc, setNewSupplierDesc] = useState('');
  const [newSupplierImageUrl, setNewSupplierImageUrl] = useState('');
  const [editingSupplier, setEditingSupplier] = useState<SupplierItem | null>(null);
  const [editSupplierName, setEditSupplierName] = useState('');
  const [editSupplierDesc, setEditSupplierDesc] = useState('');
  const [editSupplierImageUrl, setEditSupplierImageUrl] = useState('');
  const [supplierSaving, setSupplierSaving] = useState(false);
  const [uploadingSupplierImage, setUploadingSupplierImage] = useState(false);

  // Client restriction toggle state
  const [restrictClientView, setRestrictClientView] = useState(false);
  const [savingRestriction, setSavingRestriction] = useState(false);

  const uploadLogoImage = async (file: File): Promise<string | null> => {
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>(resolve => { reader.onloadend = () => resolve(reader.result as string); reader.readAsDataURL(file); });
      const res = await fetch(`${API}/api/upload`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: `logo-type-${Date.now()}-${file.name}`, fileData: base64 }) });
      if (res.ok) { const r = await res.json(); return r.url; }
    } catch (e) { console.error('Upload error:', e); }
    return null;
  };

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${API}/api/staff/settings`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const payload: SettingsPayload = await res.json();
          setAgencyProfile(payload.agencyProfile);
          setSlaConfig(payload.slaConfig);
        }
      } finally {
        setLoading(false);
      }
    };
    const fetchLogoTypes = async () => {
      try {
        const res = await fetch(`${API}/api/logo-types/all`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setLogoTypes(await res.json());
      } finally { setLogoLoading(false); }
    };
    const fetchSuppliers = async () => {
      try {
        const res = await fetch(`${API}/api/product-suppliers/all`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setSuppliers(await res.json());
      } finally { setSupplierLoading(false); }
    };
    fetchSettings(); fetchLogoTypes(); fetchSuppliers();
    // Fetch app settings (restrictClientView)
    fetch(`${API}/api/settings/app`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => {
        if (d && typeof d.restrictClientView === 'boolean') setRestrictClientView(d.restrictClientView);
      }).catch(() => {});
  }, [token]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch(`${API}/api/staff/settings/profile`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(agencyProfile),
      });
      if (res.ok) {
        showToast('تم حفظ بيانات Dot Media Operation ✅');
      } else {
        const err = await res.json();
        showToast(err.error || 'فشل حفظ بيانات Dot Media Operation', 'error');
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const saveSlaStage = async (stage: string) => {
    setEditingStage(stage);
    try {
      const res = await fetch(`${API}/api/staff/settings/sla/${stage}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ hours: slaConfig[stage] }),
      });
      if (res.ok) {
        showToast('تم تحديث SLA ✅');
      } else {
        const err = await res.json();
        showToast(err.error || 'فشل تحديث SLA', 'error');
      }
    } finally {
      setEditingStage(null);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 6) {
      setPasswordError('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('كلمة المرور الجديدة وتأكيدها غير متطابقتين');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/change-password`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setPasswordSuccess(data.message || 'تم تغيير كلمة المرور بنجاح');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordError(data.error || 'فشل تغيير كلمة المرور');
      }
    } catch {
      setPasswordError('حدث خطأ في الاتصال بالخادم');
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="space-y-4 sm:space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">{isAdmin ? 'إعدادات المدير' : 'الإعدادات'}</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">{isAdmin ? 'إدارة بيانات Dot Media Operation وتكوين SLA العام للنظام.' : 'إدارة حسابك وتغيير كلمة المرور.'}</p>
      </div>

      {/* ── Change Password ───────────────────────────────────────── */}
      <section className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm">
        <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5 text-indigo-500" /> تغيير كلمة المرور
        </h2>

        {passwordSuccess && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-medium text-emerald-700">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {passwordSuccess}
          </div>
        )}
        {passwordError && (
          <div className="p-3 mb-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium">
            {passwordError}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500">كلمة المرور الحالية</label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full p-3 sm:p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all duration-200 text-sm"
              placeholder="••••••••"
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500">كلمة المرور الجديدة</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="6 أحرف على الأقل"
              dir="ltr"
              minLength={6}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500">تأكيد كلمة المرور</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="أعد كتابة كلمة المرور"
              dir="ltr"
              minLength={6}
              required
            />
          </div>
          <div className="sm:col-span-2 md:col-span-3">
            <button
              type="submit"
              disabled={passwordLoading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 sm:py-2.5 text-sm font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-all duration-200 disabled:opacity-60 active:scale-95 cursor-pointer"
            >
              {passwordLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              تغيير كلمة المرور
            </button>
          </div>
        </form>
      </section>

      {/* ── Client View Restriction Toggle (ADMIN only) ─────────────── */}
      {isAdmin && (
        <section className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm">
          <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-500" /> تقييد العرض على العميل
          </h2>
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            عند التفعيل، مدير الحساب والأدمن فقط يمكنهم العرض على العميل (تصاميم، مقترحات، منتجات، مراجعة نهائية). عند الإيقاف، جميع الموظفين يمكنهم ذلك.
          </p>
          <label className={`flex items-center gap-4 cursor-pointer py-3 px-4 rounded-xl border-2 transition-all duration-300 ${
            restrictClientView
              ? 'bg-amber-50 border-amber-300 shadow-md shadow-amber-100/50'
              : 'bg-slate-50 border-slate-200 hover:border-slate-300'
          }`}>
            <div className={`relative w-12 h-6 rounded-full transition-all duration-300 shrink-0 ${
              restrictClientView ? 'bg-amber-500' : 'bg-slate-200'
            }`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full shadow-sm transition-all duration-300 bg-white ${
                restrictClientView ? 'left-0.5' : 'right-0.5'
              }`} />
            </div>
            <input type="checkbox" checked={restrictClientView} onChange={async (e) => {
              const newVal = e.target.checked;
              setRestrictClientView(newVal);
              setSavingRestriction(true);
              try {
                const res = await fetch(`${API}/api/settings/app`, {
                  method: 'PUT', headers,
                  body: JSON.stringify({ restrictClientView: newVal }),
                });
                if (res.ok) showToast(newVal ? 'تم تفعيل التقييد ✅' : 'تم إيقاف التقييد');
                else { const err = await res.json(); showToast(err.error || 'فشل الحفظ', 'error'); setRestrictClientView(!newVal); }
              } catch { showToast('تعذر الاتصال', 'error'); setRestrictClientView(!newVal); }
              finally { setSavingRestriction(false); }
            }} className="sr-only" />
            <div className="flex-1">
              <span className={`text-sm font-bold transition-colors ${
                restrictClientView ? 'text-amber-800' : 'text-slate-600'
              }`}>
                {restrictClientView ? '🔒 مُفعّل — مدير الحساب والأدمن فقط' : '🔓 مُعطّل — جميع الموظفين'}
              </span>
              {savingRestriction && <span className="text-[10px] text-slate-400 animate-pulse mr-2">جاري الحفظ...</span>}
            </div>
          </label>
        </section>
      )}

      {isAdmin && (
      <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-500" /> بيانات Dot Media Operation
        </h2>
        <form onSubmit={saveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500">اسم الشركة</label>
            <input
              value={agencyProfile.agencyName}
              onChange={(e) => setAgencyProfile((prev) => ({ ...prev, agencyName: e.target.value }))}
              className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="اسم الشركة"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500">البريد الإلكتروني</label>
            <input
              value={agencyProfile.contactEmail}
              onChange={(e) => setAgencyProfile((prev) => ({ ...prev, contactEmail: e.target.value }))}
              className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="admin@agency.com"
              type="email"
              required
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-500" /> رقم واتساب الاستشاري
            </label>
            <input
              value={agencyProfile.whatsappNumber}
              onChange={(e) => setAgencyProfile((prev) => ({ ...prev, whatsappNumber: e.target.value }))}
              className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="مثال: 966501234567"
              type="tel"
              dir="ltr"
            />
            <p className="text-[10px] text-slate-400">هذا الرقم سيظهر للعملاء عند الضغط على "تواصل مع الاستشاري"</p>
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-60 cursor-pointer"
            >
              {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ بيانات Dot Media Operation
            </button>
          </div>
        </form>
      </section>
      )}

      {isAdmin && (
      <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-500" /> إعدادات SLA العامة
        </h2>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-right p-3 font-bold text-slate-600">المرحلة</th>
                <th className="text-right p-3 font-bold text-slate-600">SLA (ساعات)</th>
                <th className="text-right p-3 font-bold text-slate-600">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(slaConfig).map(([stage, hours]) => (
                <tr key={stage} className="border-t border-slate-100">
                  <td className="p-3 font-medium text-slate-700">{STAGE_LABELS[stage] || stage}</td>
                  <td className="p-3 w-56">
                    <input
                      type="number"
                      min={0}
                      value={hours}
                      onChange={(e) =>
                        setSlaConfig((prev) => ({ ...prev, [stage]: Number(e.target.value || 0) }))
                      }
                      className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      dir="ltr"
                    />
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => saveSlaStage(stage)}
                      disabled={editingStage === stage}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-slate-700 transition-colors disabled:opacity-60 cursor-pointer"
                    >
                      {editingStage === stage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Settings className="w-3.5 h-3.5" />}
                      تعديل
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {/* Logo Types Management */}
      {isAdmin && (
      <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Paintbrush className="w-5 h-5 text-violet-500" /> إدارة أنواع الشعارات
        </h2>

        {/* Add new */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={newLogoName} onChange={e => setNewLogoName(e.target.value)} placeholder="اسم النوع (مطلوب)" className="flex-1 p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
            <input value={newLogoDesc} onChange={e => setNewLogoDesc(e.target.value)} placeholder="وصف قصير (اختياري)" className="flex-1 p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
          </div>
          <div className="flex items-center gap-3">
            {newImageUrl ? (
              <div className="relative">
                <img src={newImageUrl} alt="preview" className="w-12 h-12 rounded-lg object-contain bg-white border border-slate-200 p-0.5" />
                <button onClick={() => setNewImageUrl('')} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[8px] cursor-pointer">✕</button>
              </div>
            ) : (
              <label className={`flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-xl text-xs text-slate-500 hover:border-violet-400 hover:text-violet-600 transition-colors cursor-pointer ${uploadingImage ? 'opacity-50' : ''}`}>
                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  setUploadingImage(true);
                  const url = await uploadLogoImage(file);
                  if (url) setNewImageUrl(url);
                  else showToast('فشل رفع الصورة', 'error');
                  setUploadingImage(false); e.target.value = '';
                }} />
                {uploadingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                صورة توضيحية
              </label>
            )}
            <button disabled={logoSaving || !newLogoName.trim()} onClick={async () => {
              setLogoSaving(true);
              try {
                const res = await fetch(`${API}/api/logo-types`, { method: 'POST', headers, body: JSON.stringify({ name: newLogoName, description: newLogoDesc, imageUrl: newImageUrl || null }) });
                if (res.ok) { const t = await res.json(); setLogoTypes(prev => [...prev, t]); setNewLogoName(''); setNewLogoDesc(''); setNewImageUrl(''); showToast('تم إضافة نوع الشعار ✅'); }
                else { const e = await res.json(); showToast(e.error || 'فشل الإضافة', 'error'); }
              } finally { setLogoSaving(false); }
            }} className="mr-auto px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2 cursor-pointer whitespace-nowrap">
              <Plus className="w-4 h-4" /> إضافة
            </button>
          </div>
        </div>

        {logoLoading ? <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div> : (
        <div className="space-y-2">
          {logoTypes.map((lt, idx) => (
            <div key={lt.id} className={`flex items-center gap-3 p-3 rounded-xl border ${lt.isActive ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
              {editingLogo?.id === lt.id ? (
                <div className="flex-1 space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input value={editName} onChange={e => setEditName(e.target.value)} className="flex-1 p-2 border border-slate-200 rounded-lg text-sm" />
                    <input value={editDesc} onChange={e => setEditDesc(e.target.value)} className="flex-1 p-2 border border-slate-200 rounded-lg text-sm" placeholder="وصف" />
                  </div>
                  <div className="flex items-center gap-2">
                    {editImageUrl ? (
                      <div className="relative">
                        <img src={editImageUrl} alt="preview" className="w-10 h-10 rounded-lg object-contain bg-white border p-0.5" />
                        <button onClick={() => setEditImageUrl('')} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[8px] cursor-pointer">✕</button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-1.5 px-2.5 py-1.5 border border-dashed border-slate-300 rounded-lg text-[11px] text-slate-500 hover:border-violet-400 cursor-pointer">
                        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={async (e) => {
                          const file = e.target.files?.[0]; if (!file) return;
                          setUploadingImage(true);
                          const url = await uploadLogoImage(file);
                          if (url) setEditImageUrl(url);
                          setUploadingImage(false); e.target.value = '';
                        }} />
                        <Upload className="w-3 h-3" /> صورة
                      </label>
                    )}
                    <button onClick={async () => {
                      const res = await fetch(`${API}/api/logo-types/${lt.id}`, { method: 'PUT', headers, body: JSON.stringify({ name: editName, description: editDesc, imageUrl: editImageUrl || null }) });
                      if (res.ok) { const u = await res.json(); setLogoTypes(prev => prev.map(x => x.id === lt.id ? u : x)); setEditingLogo(null); showToast('تم التعديل ✅'); }
                    }} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer">حفظ</button>
                    <button onClick={() => setEditingLogo(null)} className="px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-xs font-bold cursor-pointer">إلغاء</button>
                  </div>
                </div>
              ) : (
                <>
                  {lt.imageUrl ? (
                    <img src={lt.imageUrl} alt={lt.name} className="w-[50px] h-[50px] rounded-lg object-contain bg-slate-900 border border-slate-200 p-1 shrink-0" />
                  ) : (
                    <div className="w-[50px] h-[50px] rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0"><ImageIcon className="w-5 h-5 text-slate-300" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{lt.name}</p>
                    {lt.description && <p className="text-[11px] text-slate-500 truncate">{lt.description}</p>}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">#{lt.sortOrder}</span>
                  <button onClick={() => { setEditingLogo(lt); setEditName(lt.name); setEditDesc(lt.description || ''); setEditImageUrl(lt.imageUrl || ''); }} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer" title="تعديل"><Settings className="w-3.5 h-3.5" /></button>
                  <button onClick={async () => {
                    const res = await fetch(`${API}/api/logo-types/${lt.id}`, { method: 'PUT', headers, body: JSON.stringify({ isActive: !lt.isActive }) });
                    if (res.ok) { const u = await res.json(); setLogoTypes(prev => prev.map(x => x.id === lt.id ? u : x)); showToast(lt.isActive ? 'تم التعطيل' : 'تم التفعيل'); }
                  }} className="p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer" title={lt.isActive ? 'تعطيل' : 'تفعيل'}>
                    {lt.isActive ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />}
                  </button>
                  {idx > 0 && <button onClick={async () => {
                    const newOrder = [...logoTypes]; const prev = newOrder[idx - 1]; [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], prev];
                    setLogoTypes(newOrder);
                    await fetch(`${API}/api/logo-types/reorder`, { method: 'PUT', headers, body: JSON.stringify({ ids: newOrder.map(x => x.id) }) });
                  }} className="p-1 hover:bg-slate-100 rounded cursor-pointer"><ChevronUp className="w-3.5 h-3.5 text-slate-400" /></button>}
                  {idx < logoTypes.length - 1 && <button onClick={async () => {
                    const newOrder = [...logoTypes]; const next = newOrder[idx + 1]; [newOrder[idx], newOrder[idx + 1]] = [next, newOrder[idx]];
                    setLogoTypes(newOrder);
                    await fetch(`${API}/api/logo-types/reorder`, { method: 'PUT', headers, body: JSON.stringify({ ids: newOrder.map(x => x.id) }) });
                  }} className="p-1 hover:bg-slate-100 rounded cursor-pointer"><ChevronDown className="w-3.5 h-3.5 text-slate-400" /></button>}
                  <button onClick={async () => {
                    if (!confirm('هل أنت متأكد من حذف هذا النوع؟')) return;
                    const res = await fetch(`${API}/api/logo-types/${lt.id}`, { method: 'DELETE', headers });
                    if (res.ok) { setLogoTypes(prev => prev.filter(x => x.id !== lt.id)); showToast('تم الحذف'); }
                  }} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                </>
              )}
            </div>
          ))}
          {logoTypes.length === 0 && <p className="text-sm text-slate-400 text-center py-4">لا توجد أنواع شعارات بعد</p>}
        </div>
        )}
      </section>
      )}

      {/* Product Suppliers Management */}
      {isAdmin && (
      <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-amber-500" /> 🏪 إدارة مزودي المنتجات
        </h2>

        {/* Add new supplier */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} placeholder="اسم المزود (مطلوب)" className="flex-1 p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white" />
            <input value={newSupplierDesc} onChange={e => setNewSupplierDesc(e.target.value)} placeholder="وصف قصير (اختياري)" className="flex-1 p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white" />
          </div>
          <div className="flex items-center gap-3">
            {newSupplierImageUrl ? (
              <div className="relative">
                <img src={newSupplierImageUrl} alt="preview" className="w-12 h-12 rounded-lg object-contain bg-white border border-slate-200 p-0.5" />
                <button onClick={() => setNewSupplierImageUrl('')} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[8px] cursor-pointer">✕</button>
              </div>
            ) : (
              <label className={`flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-xl text-xs text-slate-500 hover:border-amber-400 hover:text-amber-600 transition-colors cursor-pointer ${uploadingSupplierImage ? 'opacity-50' : ''}`}>
                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  setUploadingSupplierImage(true);
                  const url = await uploadLogoImage(file);
                  if (url) setNewSupplierImageUrl(url);
                  else showToast('فشل رفع الصورة', 'error');
                  setUploadingSupplierImage(false); e.target.value = '';
                }} />
                {uploadingSupplierImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                صورة توضيحية
              </label>
            )}
            <button disabled={supplierSaving || !newSupplierName.trim()} onClick={async () => {
              setSupplierSaving(true);
              try {
                const res = await fetch(`${API}/api/product-suppliers`, { method: 'POST', headers, body: JSON.stringify({ name: newSupplierName, description: newSupplierDesc, imageUrl: newSupplierImageUrl || null }) });
                if (res.ok) { const t = await res.json(); setSuppliers(prev => [...prev, t]); setNewSupplierName(''); setNewSupplierDesc(''); setNewSupplierImageUrl(''); showToast('تم إضافة المزود ✅'); }
                else { const e = await res.json(); showToast(e.error || 'فشل الإضافة', 'error'); }
              } finally { setSupplierSaving(false); }
            }} className="mr-auto px-4 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2 cursor-pointer whitespace-nowrap">
              <Plus className="w-4 h-4" /> إضافة
            </button>
          </div>
        </div>

        {supplierLoading ? <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div> : (
        <div className="space-y-2">
          {suppliers.map((sup, idx) => (
            <div key={sup.id} className={`flex items-center gap-3 p-3 rounded-xl border ${sup.isActive ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
              {editingSupplier?.id === sup.id ? (
                <div className="flex-1 space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input value={editSupplierName} onChange={e => setEditSupplierName(e.target.value)} className="flex-1 p-2 border border-slate-200 rounded-lg text-sm" />
                    <input value={editSupplierDesc} onChange={e => setEditSupplierDesc(e.target.value)} className="flex-1 p-2 border border-slate-200 rounded-lg text-sm" placeholder="وصف" />
                  </div>
                  <div className="flex items-center gap-2">
                    {editSupplierImageUrl ? (
                      <div className="relative">
                        <img src={editSupplierImageUrl} alt="preview" className="w-10 h-10 rounded-lg object-contain bg-white border p-0.5" />
                        <button onClick={() => setEditSupplierImageUrl('')} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[8px] cursor-pointer">✕</button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-1.5 px-2.5 py-1.5 border border-dashed border-slate-300 rounded-lg text-[11px] text-slate-500 hover:border-amber-400 cursor-pointer">
                        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={async (e) => {
                          const file = e.target.files?.[0]; if (!file) return;
                          setUploadingSupplierImage(true);
                          const url = await uploadLogoImage(file);
                          if (url) setEditSupplierImageUrl(url);
                          setUploadingSupplierImage(false); e.target.value = '';
                        }} />
                        <Upload className="w-3 h-3" /> صورة
                      </label>
                    )}
                    <button onClick={async () => {
                      const res = await fetch(`${API}/api/product-suppliers/${sup.id}`, { method: 'PUT', headers, body: JSON.stringify({ name: editSupplierName, description: editSupplierDesc, imageUrl: editSupplierImageUrl || null }) });
                      if (res.ok) { const u = await res.json(); setSuppliers(prev => prev.map(x => x.id === sup.id ? u : x)); setEditingSupplier(null); showToast('تم التعديل ✅'); }
                    }} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer">حفظ</button>
                    <button onClick={() => setEditingSupplier(null)} className="px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-xs font-bold cursor-pointer">إلغاء</button>
                  </div>
                </div>
              ) : (
                <>
                  {sup.imageUrl ? (
                    <img src={sup.imageUrl} alt={sup.name} className="w-[50px] h-[50px] rounded-lg object-contain bg-slate-50 border border-slate-200 p-1 shrink-0" />
                  ) : (
                    <div className="w-[50px] h-[50px] rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0"><span className="text-xl">🏪</span></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{sup.name}</p>
                    {sup.description && <p className="text-[11px] text-slate-500 truncate">{sup.description}</p>}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">#{sup.sortOrder}</span>
                  <button onClick={() => { setEditingSupplier(sup); setEditSupplierName(sup.name); setEditSupplierDesc(sup.description || ''); setEditSupplierImageUrl(sup.imageUrl || ''); }} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer" title="تعديل"><Settings className="w-3.5 h-3.5" /></button>
                  <button onClick={async () => {
                    const res = await fetch(`${API}/api/product-suppliers/${sup.id}`, { method: 'PUT', headers, body: JSON.stringify({ isActive: !sup.isActive }) });
                    if (res.ok) { const u = await res.json(); setSuppliers(prev => prev.map(x => x.id === sup.id ? u : x)); showToast(sup.isActive ? 'تم التعطيل' : 'تم التفعيل'); }
                  }} className="p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer" title={sup.isActive ? 'تعطيل' : 'تفعيل'}>
                    {sup.isActive ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />}
                  </button>
                  {idx > 0 && <button onClick={async () => {
                    const newOrder = [...suppliers]; const prev = newOrder[idx - 1]; [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], prev];
                    setSuppliers(newOrder);
                    await fetch(`${API}/api/product-suppliers/reorder`, { method: 'PUT', headers, body: JSON.stringify({ ids: newOrder.map(x => x.id) }) });
                  }} className="p-1 hover:bg-slate-100 rounded cursor-pointer"><ChevronUp className="w-3.5 h-3.5 text-slate-400" /></button>}
                  {idx < suppliers.length - 1 && <button onClick={async () => {
                    const newOrder = [...suppliers]; const next = newOrder[idx + 1]; [newOrder[idx], newOrder[idx + 1]] = [next, newOrder[idx]];
                    setSuppliers(newOrder);
                    await fetch(`${API}/api/product-suppliers/reorder`, { method: 'PUT', headers, body: JSON.stringify({ ids: newOrder.map(x => x.id) }) });
                  }} className="p-1 hover:bg-slate-100 rounded cursor-pointer"><ChevronDown className="w-3.5 h-3.5 text-slate-400" /></button>}
                  <button onClick={async () => {
                    if (!confirm('هل أنت متأكد من حذف هذا المزود؟')) return;
                    const res = await fetch(`${API}/api/product-suppliers/${sup.id}`, { method: 'DELETE', headers });
                    if (res.ok) { setSuppliers(prev => prev.filter(x => x.id !== sup.id)); showToast('تم الحذف'); }
                  }} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                </>
              )}
            </div>
          ))}
          {suppliers.length === 0 && <p className="text-sm text-slate-400 text-center py-4">لا يوجد مزودي منتجات بعد</p>}
        </div>
        )}
      </section>
      )}
    </div>
  );
}
