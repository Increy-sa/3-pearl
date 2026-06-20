import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { UserPlus, Trash2, Power, PowerOff, Loader2, Edit3, KeyRound, X, Search, Filter } from 'lucide-react';
import { API_URL } from '../../config/api';
import { useToast } from '../../components/ui/Toast';

const API = API_URL;

const ROLE_DISPLAY: Record<string, string> = {
  ADMIN: 'مدير النظام',
  ACCOUNT_MANAGER: 'مدير حساب',
  SEO: 'مختص SEO',
  DESIGNER: 'مصمم',
  DEVELOPER: 'مطوّر',
};

const ROLE_BADGE_COLORS: Record<string, string> = {
  ADMIN: 'bg-purple-50 text-purple-600 border-purple-200',
  ACCOUNT_MANAGER: 'bg-blue-50 text-blue-600 border-blue-200',
  SEO: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  DESIGNER: 'bg-pink-50 text-pink-600 border-pink-200',
  DEVELOPER: 'bg-orange-50 text-orange-600 border-orange-200',
};

const ASSIGNABLE_ROLES = ['ACCOUNT_MANAGER', 'SEO', 'DESIGNER', 'DEVELOPER'];
const ALL_STAFF_ROLES = ['ADMIN', 'ACCOUNT_MANAGER', 'SEO', 'DESIGNER', 'DEVELOPER'];

export function ManageStaff() {
  const { token } = useAuthStore();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', role: 'ACCOUNT_MANAGER' });
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Edit modal
  const [editUser, setEditUser] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ name: '', role: '' });
  const [editError, setEditError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('');

  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  const { showToast } = useToast();

  const fetchStaff = async () => {
    try {
      const res = await fetch(`${API}/api/admin/staff`, { headers });
      if (res.ok) setStaff(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStaff(); }, [token]);

  // ── Add Staff ──────────────────────────────────────
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    if (!addForm.name.trim() || !addForm.email.trim()) {
      setAddError('الاسم والبريد الإلكتروني مطلوبين');
      return;
    }
    setIsAdding(true);
    try {
      const res = await fetch(`${API}/api/staff/create`, {
        method: 'POST', headers,
        body: JSON.stringify(addForm),
      });
      if (res.ok) {
        setShowAddModal(false);
        setAddForm({ name: '', email: '', role: 'ACCOUNT_MANAGER' });
        setAddError(null);
        showToast('تم إضافة الموظف بنجاح ✅');
        fetchStaff();
      } else {
        const err = await res.json();
        setAddError(err.error || 'فشل الإضافة');
      }
    } catch { setAddError('تعذر الاتصال بالخادم'); }
    finally { setIsAdding(false); }
  };

  // ── Edit Staff ──────────────────────────────────────
  const openEditModal = (user: any) => {
    setEditUser(user);
    setEditForm({ name: user.name, role: user.role });
    setEditError(null);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setEditError(null);
    setIsEditing(true);
    try {
      const res = await fetch(`${API}/api/staff/${editUser.id}/update`, {
        method: 'PUT', headers,
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEditUser(null);
        showToast('تم تحديث بيانات الموظف بنجاح ✅');
        fetchStaff();
      } else {
        const err = await res.json();
        setEditError(err.error || 'فشل التحديث');
      }
    } catch { setEditError('تعذر الاتصال بالخادم'); }
    finally { setIsEditing(false); }
  };

  // ── Toggle Status ──────────────────────────────────
  const toggleStatus = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`${API}/api/staff/${id}/toggle-status`, { method: 'PUT', headers });
      if (res.ok) {
        const data = await res.json();
        setStaff(prev => prev.map(s => s.id === id ? data.user : s));
        showToast(data.user.isActive ? 'تم تنشيط الموظف ✅' : 'تم تعطيل الموظف');
      } else { const err = await res.json(); showToast(err.error || 'فشل الإجراء', 'error'); }
    } finally { setActionLoading(null); }
  };

  // ── Reset Password ─────────────────────────────────
  const resetPassword = async (id: string, name: string) => {
    if (!confirm(`سيتم إعادة تعيين كلمة مرور "${name}" إلى 123456\n\nهل أنت متأكد؟`)) return;
    setActionLoading(id);
    try {
      const res = await fetch(`${API}/api/staff/${id}/reset-password`, { method: 'PUT', headers });
      if (res.ok) {
        showToast('تم إعادة تعيين كلمة المرور إلى 123456 ✅');
      } else { const err = await res.json(); showToast(err.error || 'فشل الإجراء', 'error'); }
    } finally { setActionLoading(null); }
  };

  // ── Hard Delete ────────────────────────────────────
  const hardDelete = async (id: string, name: string) => {
    if (!confirm(`⚠️ حذف نهائي!\n\nسيتم حذف "${name}" بالكامل من النظام ولا يمكن التراجع.\n\nهل أنت متأكد؟`)) return;
    setActionLoading(id);
    try {
      const res = await fetch(`${API}/api/staff/${id}/hard`, { method: 'DELETE', headers });
      if (res.ok) { setStaff(prev => prev.filter(s => s.id !== id)); showToast('تم حذف الموظف بنجاح'); }
      else { const err = await res.json(); showToast(err.error || 'فشل الحذف', 'error'); }
    } finally { setActionLoading(null); }
  };

  // ── Filtered Staff ─────────────────────────────────
  const filteredStaff = staff.filter(u => {
    if (filterRole && u.role !== filterRole) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    }
    return true;
  });

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-5" dir="rtl">
      {/* ── Header ─────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">إدارة فريق العمل</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{staff.length} عضو مسجّل</p>
        </div>
        <button onClick={() => { setShowAddModal(true); setAddError(null); }} className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-3 sm:py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all duration-200 shadow-sm active:scale-95">
          <UserPlus className="w-4 h-4" /> إضافة موظف
        </button>
      </div>

      {/* ── Search & Filter Bar ─────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو البريد..."
            className="w-full pr-10 pl-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
          />
        </div>
        <div className="relative">
          <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
            className="w-full sm:w-48 pr-10 pl-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 appearance-none transition-all"
          >
            <option value="">كل الأدوار</option>
            {ALL_STAFF_ROLES.map(r => (
              <option key={r} value={r}>{ROLE_DISPLAY[r]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Staff Table ─────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase">
                <th className="text-right px-4 py-3">الموظف</th>
                <th className="text-right px-4 py-3 hidden sm:table-cell">البريد الإلكتروني</th>
                <th className="text-center px-4 py-3">الدور</th>
                <th className="text-center px-4 py-3">الحالة</th>
                <th className="text-center px-4 py-3">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStaff.map(user => {
                const isLoading = actionLoading === user.id;
                const badgeColor = ROLE_BADGE_COLORS[user.role] || 'bg-slate-50 text-slate-600 border-slate-200';
                return (
                  <tr key={user.id} className={`hover:bg-slate-50/50 transition-colors ${!user.isActive ? 'opacity-60 bg-red-50/20' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {user.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{user.name}</p>
                          <p className="text-xs text-slate-400 sm:hidden">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell">{user.email}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block text-[10px] px-2.5 py-1 rounded-lg font-bold border ${badgeColor}`}>
                        {ROLE_DISPLAY[user.role] || user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block text-[10px] px-2.5 py-1 rounded-lg font-bold ${user.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                        {user.isActive ? 'نشط' : 'معطل'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEditModal(user)}
                          disabled={isLoading}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                          title="تعديل"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleStatus(user.id)}
                          disabled={isLoading}
                          className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${user.isActive ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                          title={user.isActive ? 'تعطيل' : 'تنشيط'}
                        >
                          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : user.isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => resetPassword(user.id, user.name)}
                          disabled={isLoading}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                          title="إعادة تعيين كلمة المرور"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => hardDelete(user.id, user.name)}
                          disabled={isLoading}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="حذف نهائي"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredStaff.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400 text-sm">
                    لا توجد نتائج
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add Staff Modal ─────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <form onSubmit={handleAdd} className="relative bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900">إضافة موظف جديد</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <p className="text-xs text-slate-400 -mt-2">كلمة المرور الافتراضية: <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">123456</span></p>
            <input
              required placeholder="الاسم الكامل"
              value={addForm.name}
              onChange={e => setAddForm({ ...addForm, name: e.target.value })}
              className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm transition-all"
            />
            <input
              required type="email" placeholder="البريد الإلكتروني"
              value={addForm.email}
              onChange={e => setAddForm({ ...addForm, email: e.target.value })}
              className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm transition-all"
            />
            <select
              value={addForm.role}
              onChange={e => setAddForm({ ...addForm, role: e.target.value })}
              className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm transition-all"
            >
              {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{ROLE_DISPLAY[r]}</option>)}
            </select>
            {addError && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700 font-medium">{addError}</div>
            )}
            <button type="submit" disabled={isAdding} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {isAdding && <Loader2 className="w-4 h-4 animate-spin" />}
              إضافة موظف
            </button>
          </form>
        </div>
      )}

      {/* ── Edit Staff Modal ─────────────────── */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditUser(null)} />
          <form onSubmit={handleEdit} className="relative bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900">تعديل بيانات الموظف</h3>
              <button type="button" onClick={() => setEditUser(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <input
              required placeholder="الاسم الكامل"
              value={editForm.name}
              onChange={e => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm transition-all"
            />
            <input
              disabled
              value={editUser.email}
              className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-400 cursor-not-allowed"
            />
            <select
              value={editForm.role}
              onChange={e => setEditForm({ ...editForm, role: e.target.value })}
              className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm transition-all"
            >
              {ALL_STAFF_ROLES.map(r => <option key={r} value={r}>{ROLE_DISPLAY[r]}</option>)}
            </select>
            {editError && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700 font-medium">{editError}</div>
            )}
            <button type="submit" disabled={isEditing} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {isEditing && <Loader2 className="w-4 h-4 animate-spin" />}
              حفظ التعديلات
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
