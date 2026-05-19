import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { UserPlus, Trash2, Power, PowerOff, Loader2 } from 'lucide-react';

import { API_URL } from '../../config/api';

const API = API_URL;
const ROLE_DISPLAY: Record<string, string> = {
  ADMIN: 'مدير النظام', ACCOUNT_MANAGER: 'مدير حساب', DESIGNER: 'مصمم', DEVELOPER: 'مطوّر', QA: 'مراجع جودة',
};
const ROLES = ['ADMIN', 'ACCOUNT_MANAGER', 'DESIGNER', 'DEVELOPER', 'QA'];

export function ManageStaff() {
  const { token } = useAuthStore();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', role: 'ACCOUNT_MANAGER', password: '' });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchStaff = async () => {
    try {
      const res = await fetch(`${API}/api/admin/staff`, { headers });
      if (res.ok) setStaff(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStaff(); }, [token]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API}/api/admin/staff`, { method: 'POST', headers, body: JSON.stringify(formData) });
    if (res.ok) { setShowAddModal(false); setFormData({ name: '', email: '', role: 'ACCOUNT_MANAGER', password: '' }); fetchStaff(); }
  };

  const toggleStatus = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`${API}/api/staff/${id}/toggle-status`, { method: 'PUT', headers });
      if (res.ok) {
        const data = await res.json();
        setStaff(prev => prev.map(s => s.id === id ? data.user : s));
      } else { const err = await res.json(); alert(err.error); }
    } finally { setActionLoading(null); }
  };

  const hardDelete = async (id: string, name: string) => {
    if (!confirm(`⚠️ حذف نهائي!\n\nسيتم حذف "${name}" بالكامل من النظام ولا يمكن التراجع.\n\nهل أنت متأكد؟`)) return;
    setActionLoading(id);
    try {
      const res = await fetch(`${API}/api/staff/${id}/hard`, { method: 'DELETE', headers });
      if (res.ok) { setStaff(prev => prev.filter(s => s.id !== id)); }
      else { const err = await res.json(); alert(err.error); }
    } finally { setActionLoading(null); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-4 sm:space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">إدارة فريق العمل</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{staff.length} عضو مسجّل</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-3 sm:py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all duration-200 shadow-sm active:scale-95">
          <UserPlus className="w-4 h-4" /> إضافة موظف
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
        {staff.map(user => {
          const isLoading = actionLoading === user.id;
          return (
            <div key={user.id} className={`bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl border shadow-sm transition-all duration-200 ${user.isActive ? 'border-slate-200' : 'border-red-200 bg-red-50/30 opacity-75'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900">{user.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
                </div>
                <span className={`text-[10px] px-2 py-1 rounded-lg font-bold ${user.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                  {user.isActive ? 'نشط' : 'معطل'}
                </span>
              </div>
              <div className="mt-3">
                <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-lg font-bold">{ROLE_DISPLAY[user.role] || user.role}</span>
              </div>
              {/* Action Buttons */}
              <div className="mt-4 flex gap-2">
                <button onClick={() => toggleStatus(user.id)} disabled={isLoading}
                  className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2.5 sm:py-2 text-[11px] sm:text-xs font-bold rounded-xl border transition-all duration-200 active:scale-95 ${
                    user.isActive
                      ? 'text-red-700 bg-red-50 border-red-200 hover:bg-red-100'
                      : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                  }`}>
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : user.isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                  {user.isActive ? 'تعطيل الحساب' : 'تنشيط الحساب'}
                </button>
                <button onClick={() => hardDelete(user.id, user.name)} disabled={isLoading}
                  className="flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2.5 sm:py-2 text-[11px] sm:text-xs font-bold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 rounded-xl transition-all duration-200 active:scale-95">
                  <Trash2 className="w-3.5 h-3.5" />
                  حذف نهائي
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <form onSubmit={handleAdd} className="relative bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 w-full max-w-md space-y-3 sm:space-y-4 shadow-2xl">
            <h3 className="text-lg sm:text-xl font-bold text-slate-900">إضافة عضو جديد</h3>
            <input required placeholder="الاسم" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm transition-all duration-200" />
            <input required type="email" placeholder="البريد الإلكتروني" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm transition-all duration-200" />
            <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm transition-all duration-200">
              {ROLES.map(r => <option key={r} value={r}>{ROLE_DISPLAY[r]}</option>)}
            </select>
            <input required type="password" placeholder="كلمة المرور" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm transition-all duration-200" />
            <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all duration-200 active:scale-[0.98]">إضافة</button>
          </form>
        </div>
      )}
    </div>
  );
}
