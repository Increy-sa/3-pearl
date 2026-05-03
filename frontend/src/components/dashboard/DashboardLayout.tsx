import { useEffect } from 'react';
import { Users, FileText, Settings, LogOut, LayoutDashboard, Bell, BarChart3 } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';

const ROLE_DISPLAY: Record<string, string> = {
  ADMIN: 'مدير النظام', ACCOUNT_MANAGER: 'مدير حساب', DESIGNER: 'مصمم', DEVELOPER: 'مطوّر', QA: 'مراجع جودة',
};

export function DashboardLayout() {
  const { user, token, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const fetchNotifs = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/notifications', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) await res.json();
    } catch (e) {}
  };

  useEffect(() => { fetchNotifs(); }, [token]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const isAdmin = user?.role === 'ADMIN';
  const isAM = user?.role === 'ACCOUNT_MANAGER';

  return (
    <div className="flex h-screen bg-slate-50" dir="rtl">
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-indigo-400" /> نظام الوكالة
          </h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 mt-4">
          <Link to="/dashboard" className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm ${location.pathname === '/dashboard' ? 'bg-indigo-500/10 text-indigo-400' : 'hover:bg-slate-800'}`}>
            <FileText className="w-5 h-5" /> لوحة الطلبات
          </Link>
          {(isAdmin || isAM) && (
            <Link to="/dashboard/staff" className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm ${location.pathname === '/dashboard/staff' ? 'bg-indigo-500/10 text-indigo-400' : 'hover:bg-slate-800'}`}>
              <Users className="w-5 h-5" /> إدارة فريق العمل
            </Link>
          )}

          {isAdmin && (
            <div className="pt-4 mt-4 border-t border-slate-800 space-y-1">
              <Link to="/dashboard/reports" className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm ${location.pathname === '/dashboard/reports' ? 'bg-indigo-500/10 text-indigo-400' : 'hover:bg-slate-800'}`}>
                <BarChart3 className="w-5 h-5" /> التقارير والإحصائيات
              </Link>
              <Link to="/dashboard/settings" className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm ${location.pathname === '/dashboard/settings' ? 'bg-indigo-500/10 text-indigo-400' : 'hover:bg-slate-800'}`}>
                <Settings className="w-5 h-5" /> الإعدادات
              </Link>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4 px-3">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">{user?.name?.charAt(0)}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-500">{ROLE_DISPLAY[user?.role || '']}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex w-full items-center gap-3 px-4 py-2 hover:text-white text-slate-400 text-sm">
            <LogOut className="w-4 h-4" /> تسجيل الخروج
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="bg-white border-b px-8 py-4 flex justify-between items-center">
          <h2 className="text-lg font-bold">إدارة خط الإنتاج</h2>
          <div className="flex items-center gap-4">
            <Bell className="w-5 h-5 text-slate-400" />
            <span className="bg-emerald-50 text-emerald-600 font-bold px-2.5 py-1 rounded-full text-xs">{user?.role}</span>
          </div>
        </header>
        <div className="p-8"><Outlet /></div>
      </main>
    </div>
  );
}
