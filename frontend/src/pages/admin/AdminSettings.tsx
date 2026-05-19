import React, { useEffect, useState } from 'react';
import { Loader2, Save, Settings, Lock, KeyRound, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';


import { API_URL } from '../../config/api';

const API = API_URL;

type SettingsPayload = {
  agencyProfile: {
    agencyName: string;
    contactEmail: string;
  };
  slaConfig: Record<string, number>;
};

export function AdminSettings() {
  const { token, user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editingStage, setEditingStage] = useState<string | null>(null);
  const [agencyProfile, setAgencyProfile] = useState({ agencyName: '', contactEmail: '' });
  const [slaConfig, setSlaConfig] = useState<Record<string, number>>({});

  // Password change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

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
    fetchSettings();
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
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'فشل حفظ بيانات الوكالة');
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
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'فشل تحديث SLA');
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
        <p className="text-xs sm:text-sm text-slate-500 mt-1">{isAdmin ? 'إدارة بيانات الوكالة وتكوين SLA العام للنظام.' : 'إدارة حسابك وتغيير كلمة المرور.'}</p>
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
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 sm:py-2.5 text-sm font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-all duration-200 disabled:opacity-60 active:scale-95"
            >
              {passwordLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              تغيير كلمة المرور
            </button>
          </div>
        </form>
      </section>

      {isAdmin && (
      <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-bold text-slate-800 mb-4">Agency Profile</h2>
        <form onSubmit={saveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            value={agencyProfile.agencyName}
            onChange={(e) => setAgencyProfile((prev) => ({ ...prev, agencyName: e.target.value }))}
            className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="Agency Name"
            required
          />
          <input
            value={agencyProfile.contactEmail}
            onChange={(e) => setAgencyProfile((prev) => ({ ...prev, contactEmail: e.target.value }))}
            className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="Contact Email"
            type="email"
            required
          />
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-60"
            >
              {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ بيانات الوكالة
            </button>
          </div>
        </form>
      </section>
      )}

      {isAdmin && (
      <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-bold text-slate-800 mb-4">Global SLA Config</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-right p-3 font-bold text-slate-600">Stage</th>
                <th className="text-right p-3 font-bold text-slate-600">SLA (hours)</th>
                <th className="text-right p-3 font-bold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(slaConfig).map(([stage, hours]) => (
                <tr key={stage} className="border-t border-slate-100">
                  <td className="p-3 font-medium text-slate-700">{stage}</td>
                  <td className="p-3 w-56">
                    <input
                      type="number"
                      min={0}
                      value={hours}
                      onChange={(e) =>
                        setSlaConfig((prev) => ({ ...prev, [stage]: Number(e.target.value || 0) }))
                      }
                      className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => saveSlaStage(stage)}
                      disabled={editingStage === stage}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-slate-700 transition-colors disabled:opacity-60"
                    >
                      {editingStage === stage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Settings className="w-3.5 h-3.5" />}
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      )}
    </div>
  );
}
